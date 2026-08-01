/**
 * Upload validation and storage-key generation.
 *
 * File upload is the most dangerous surface in the library module, so the rules
 * here are deliberately strict and deny-by-default:
 *
 *   1. The client-supplied MIME type is treated as a *hint*, never as proof.
 *      Browsers derive it from the file extension, so renaming `shell.php` to
 *      `notes.pdf` produces `application/pdf`. Real validation reads the magic
 *      bytes (`sniffMimeType`).
 *   2. The stored filename is generated, never derived from user input. This is
 *      what closes path traversal (`../../.env`), null-byte tricks, Windows
 *      reserved device names (`CON`, `NUL`), and case-collision overwrites.
 *   3. The original filename is kept only as a database column, used for the
 *      `Content-Disposition` header on download — never to touch the disk.
 *
 * Nothing here imports `next/*`, so it can be unit-tested directly.
 */

import { createHash, randomBytes } from "crypto";
import { extname } from "path";

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per file
export const MAX_FILES_PER_UPLOAD = 20;
export const MAX_TOTAL_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB per batch

/**
 * Allowed types, keyed by canonical MIME.
 *
 * An allowlist, never a blocklist: a blocklist has to anticipate every
 * dangerous extension, and misses the next one.
 *
 * Note the deliberate omissions — SVG (executes embedded script when opened
 * directly, so it is an XSS vector), and HTML/JS/PHP for the same reason.
 */
export const ALLOWED_TYPES: Record<
  string,
  { extensions: readonly string[]; kind: string; label: string }
> = {
  "application/pdf": { extensions: ["pdf"], kind: "HANDOUT", label: "PDF" },

  // Office
  "application/msword": { extensions: ["doc"], kind: "HANDOUT", label: "Word" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extensions: ["docx"],
    kind: "HANDOUT",
    label: "Word",
  },
  "application/vnd.ms-powerpoint": { extensions: ["ppt"], kind: "LESSON", label: "PowerPoint" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    extensions: ["pptx"],
    kind: "LESSON",
    label: "PowerPoint",
  },
  "application/vnd.ms-excel": { extensions: ["xls"], kind: "HANDOUT", label: "Excel" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    extensions: ["xlsx"],
    kind: "HANDOUT",
    label: "Excel",
  },

  // Images (no SVG — see above)
  "image/jpeg": { extensions: ["jpg", "jpeg"], kind: "REFERENCE", label: "Image" },
  "image/png": { extensions: ["png"], kind: "REFERENCE", label: "Image" },
  "image/gif": { extensions: ["gif"], kind: "REFERENCE", label: "Image" },
  "image/webp": { extensions: ["webp"], kind: "REFERENCE", label: "Image" },

  // Video / audio
  "video/mp4": { extensions: ["mp4"], kind: "VIDEO", label: "Video" },
  "video/webm": { extensions: ["webm"], kind: "VIDEO", label: "Video" },
  "video/quicktime": { extensions: ["mov"], kind: "VIDEO", label: "Video" },
  "audio/mpeg": { extensions: ["mp3"], kind: "VIDEO", label: "Audio" },

  // Plain text
  "text/plain": { extensions: ["txt"], kind: "HANDOUT", label: "Text" },
  "text/csv": { extensions: ["csv"], kind: "HANDOUT", label: "CSV" },

  // Archives
  "application/zip": { extensions: ["zip"], kind: "REFERENCE", label: "Archive" },
};

/** Fast reverse lookup: extension -> canonical MIME. */
const EXTENSION_TO_MIME = new Map<string, string>();
for (const [mime, config] of Object.entries(ALLOWED_TYPES)) {
  for (const extension of config.extensions) {
    EXTENSION_TO_MIME.set(extension, mime);
  }
}

// ---------------------------------------------------------------------------
// Magic-byte sniffing
// ---------------------------------------------------------------------------

/**
 * File signatures. `offset` handles containers that do not start at byte 0
 * (MP4's `ftyp` box begins at offset 4).
 *
 * ZIP-based Office formats (docx/pptx/xlsx) are all literally ZIP archives, so
 * they sniff as `application/zip`. `isMimeCompatible` treats that as a match
 * rather than trying to parse the container.
 */
const SIGNATURES: Array<{ mime: string; offset: number; bytes: readonly number[] }> = [
  { mime: "application/pdf", offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "image/jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/gif", offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { mime: "application/zip", offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK..
  { mime: "application/zip", offset: 0, bytes: [0x50, 0x4b, 0x05, 0x06] }, // empty archive
  { mime: "video/mp4", offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // ftyp
  { mime: "audio/mpeg", offset: 0, bytes: [0x49, 0x44, 0x33] }, // ID3
  { mime: "application/msword", offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0] }, // OLE2
];

/** RIFF containers need a second check at offset 8 to disambiguate. */
const RIFF_HEADER = [0x52, 0x49, 0x46, 0x46];

/**
 * Formats whose signature MUST be present and match.
 *
 * Everything with a reliable magic number belongs here. Absence from this set
 * is what allows `.txt` and `.csv` — which have no signature at all — to be
 * accepted, and nothing else.
 */
const SIGNATURE_REQUIRED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/zip",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "application/msword",
  "application/vnd.ms-powerpoint",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function matchesAt(buffer: Buffer, offset: number, bytes: readonly number[]) {
  if (buffer.length < offset + bytes.length) return false;

  for (let index = 0; index < bytes.length; index += 1) {
    if (buffer[offset + index] !== bytes[index]) return false;
  }

  return true;
}

/**
 * Identify a file from its leading bytes. Returns `null` for formats with no
 * reliable signature (plain text, CSV).
 */
export function sniffMimeType(buffer: Buffer): string | null {
  // WEBP is "RIFF....WEBP".
  if (matchesAt(buffer, 0, RIFF_HEADER) && matchesAt(buffer, 8, [0x57, 0x45, 0x42, 0x50])) {
    return "image/webp";
  }

  // WEBM/Matroska.
  if (matchesAt(buffer, 0, [0x1a, 0x45, 0xdf, 0xa3])) {
    return "video/webm";
  }

  for (const signature of SIGNATURES) {
    if (matchesAt(buffer, signature.offset, signature.bytes)) {
      return signature.mime;
    }
  }

  return null;
}

/**
 * Whether a sniffed type is an acceptable match for a declared one.
 *
 * The ZIP special case exists because every modern Office format is a ZIP
 * archive underneath; rejecting that mismatch would reject every .docx.
 */
function isMimeCompatible(declared: string, sniffed: string) {
  if (declared === sniffed) return true;

  const zipBased = [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ];

  if (sniffed === "application/zip" && zipBased.includes(declared)) return true;

  // Legacy Office formats all share the OLE2 container.
  const ole2Based = [
    "application/msword",
    "application/vnd.ms-powerpoint",
    "application/vnd.ms-excel",
  ];

  if (sniffed === "application/msword" && ole2Based.includes(declared)) return true;

  // QuickTime and MP4 share the ISO base media container.
  if (sniffed === "video/mp4" && declared === "video/quicktime") return true;

  return false;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class UploadValidationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "TOO_LARGE"
      | "EMPTY"
      | "DISALLOWED_TYPE"
      | "EXTENSION_MISMATCH"
      | "CONTENT_MISMATCH"
      | "TOO_MANY_FILES",
  ) {
    super(message);
    this.name = "UploadValidationError";
  }
}

/** Lower-case extension without the dot. */
export function getExtension(filename: string) {
  return extname(filename).replace(/^\./, "").toLowerCase();
}

/** Human-readable size for the UI: 1536 -> "1.5 KB". */
export function formatFileSize(bytes: number) {
  if (bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  // Whole numbers for bytes, one decimal above that.
  return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`;
}

export type ValidatedUpload = {
  originalName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  kind: string;
  label: string;
  checksum: string;
  storageKey: string;
};

/**
 * Validate one uploaded file. Throws `UploadValidationError` on rejection.
 *
 * Order matters: cheap checks (size, extension) run before hashing the whole
 * buffer, so an oversized file is rejected without doing the expensive work.
 */
export function validateUpload(input: {
  filename: string;
  declaredMimeType?: string | null;
  buffer: Buffer;
}): ValidatedUpload {
  const { filename, buffer } = input;

  if (buffer.length === 0) {
    throw new UploadValidationError("That file is empty.", "EMPTY");
  }

  if (buffer.length > MAX_FILE_BYTES) {
    throw new UploadValidationError(
      `Files must be ${formatFileSize(MAX_FILE_BYTES)} or smaller. This one is ${formatFileSize(buffer.length)}.`,
      "TOO_LARGE",
    );
  }

  const extension = getExtension(filename);

  if (!extension) {
    throw new UploadValidationError("That file has no extension.", "DISALLOWED_TYPE");
  }

  // Resolve the canonical type from the extension, not from the browser's
  // claim — the browser derives its claim from the extension anyway.
  const canonicalMime = EXTENSION_TO_MIME.get(extension);

  if (!canonicalMime) {
    throw new UploadValidationError(
      `".${extension}" files are not allowed. Accepted types: ${describeAllowedTypes()}.`,
      "DISALLOWED_TYPE",
    );
  }

  // --- Content check ---------------------------------------------------
  //
  // This previously only rejected a *recognised* signature that disagreed with
  // the extension, and let an unrecognised one through. That is backwards: a
  // Windows executable renamed to .pdf sniffs as `null`, so it passed.
  //
  // For any format that has a signature, the signature must be present AND
  // match. Only genuinely signature-less formats may skip the check.
  const sniffed = sniffMimeType(buffer);

  if (SIGNATURE_REQUIRED.has(canonicalMime)) {
    if (!sniffed) {
      throw new UploadValidationError(
        `That file does not look like a real ".${extension}" file. It may be renamed or corrupt.`,
        "CONTENT_MISMATCH",
      );
    }

    if (!isMimeCompatible(canonicalMime, sniffed)) {
      throw new UploadValidationError(
        `That file's contents do not match its ".${extension}" extension. It may be corrupt or renamed.`,
        "CONTENT_MISMATCH",
      );
    }
  } else if (sniffed && !isMimeCompatible(canonicalMime, sniffed)) {
    // Signature-less format, but the bytes clearly belong to something else.
    throw new UploadValidationError(
      `That file's contents do not match its ".${extension}" extension.`,
      "CONTENT_MISMATCH",
    );
  }

  const config = ALLOWED_TYPES[canonicalMime];

  return {
    originalName: sanitizeDisplayName(filename),
    mimeType: canonicalMime,
    extension,
    sizeBytes: buffer.length,
    kind: config.kind,
    label: config.label,
    checksum: hashBuffer(buffer),
    storageKey: createStorageKey(extension),
  };
}

/** Guard for a multi-file batch, before any single file is processed. */
export function validateBatch(files: Array<{ size: number }>) {
  if (files.length === 0) {
    throw new UploadValidationError("Select at least one file.", "EMPTY");
  }

  if (files.length > MAX_FILES_PER_UPLOAD) {
    throw new UploadValidationError(
      `Upload at most ${MAX_FILES_PER_UPLOAD} files at once.`,
      "TOO_MANY_FILES",
    );
  }

  const total = files.reduce((sum, file) => sum + file.size, 0);

  if (total > MAX_TOTAL_UPLOAD_BYTES) {
    throw new UploadValidationError(
      `That batch totals ${formatFileSize(total)}; the limit is ${formatFileSize(MAX_TOTAL_UPLOAD_BYTES)}.`,
      "TOO_LARGE",
    );
  }
}

// ---------------------------------------------------------------------------
// Naming and hashing
// ---------------------------------------------------------------------------

/**
 * Generate the on-disk key. Entirely random plus a date prefix — no part of it
 * comes from user input, which is what makes path traversal impossible by
 * construction rather than by filtering.
 *
 * The date prefix keeps directories from growing to millions of entries.
 */
export function createStorageKey(extension: string) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const id = randomBytes(16).toString("hex");

  return `${year}/${month}/${id}.${extension}`;
}

/**
 * Clean a filename for *display and download* only.
 *
 * This value never touches the filesystem — `createStorageKey` handles that.
 * It still strips directory separators and control characters, because it ends
 * up in a `Content-Disposition` header where a newline would enable header
 * injection.
 */
export function sanitizeDisplayName(filename: string) {
  const base = filename
    .replace(/[\\/]/g, "_") // path separators
    // Stripping control characters is the point here — NUL and newline in
    // particular, which would otherwise reach a Content-Disposition header.
    .replace(/[\u0000-\u001F\u007F]/g, "") // control chars, incl. NUL and newlines
    .replace(/^\.+/, "") // leading dots ("..", ".env")
    .trim();

  const safe = base || "file";

  // Keep filenames short enough for every filesystem and header.
  return safe.length > 200 ? `${safe.slice(0, 180)}.${getExtension(safe)}` : safe;
}

/** SHA-256 of the contents — the key for duplicate detection. */
export function hashBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Comma-separated extension list, for error messages and the file picker. */
export function describeAllowedTypes() {
  return Object.values(ALLOWED_TYPES)
    .flatMap((config) => config.extensions)
    .map((extension) => `.${extension}`)
    .join(", ");
}

/** `accept` attribute value for `<input type="file">`. */
export const FILE_INPUT_ACCEPT = Object.entries(ALLOWED_TYPES)
  .flatMap(([mime, config]) => [mime, ...config.extensions.map((ext) => `.${ext}`)])
  .join(",");
