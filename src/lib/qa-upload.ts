/**
 * Reading a Q&A attachment off a multipart request.
 *
 * Shared by the ask route and the answer route so both apply the same rules —
 * and so there is one place to look when asking "what can be attached to a
 * question?".
 *
 * Validation is `validateUpload` from the library module, unchanged: the magic
 * bytes must match the extension, the extension must be on the allowlist, and
 * the stored filename is generated rather than derived from anything the user
 * typed. A renamed executable is rejected here for exactly the reasons it is
 * rejected from the library.
 *
 * The size limit is lower, though. A question is a photo of a problem or a
 * one-page handout, not a 50 MB lecture recording, and every one of these is
 * attached to a row that nobody will ever clean up.
 */

import { validateUpload, UploadValidationError, formatFileSize } from "@/lib/upload";
import { saveFile } from "@/lib/storage";
import type { QaAttachment } from "@/lib/qa";

/** 12 MB — a phone photo of a whiteboard is about 4. */
export const MAX_QA_ATTACHMENT_BYTES = 12 * 1024 * 1024;

/**
 * Pull the optional attachment out of a form and write it to storage.
 *
 * @returns the stored attachment, or null when no file was sent
 * @throws UploadValidationError when a file was sent and is not acceptable
 */
export async function readQaAttachment(
  form: FormData,
  field = "attachment",
): Promise<QaAttachment | null> {
  const entry = form.get(field);

  // An empty file input posts a zero-byte File rather than nothing at all, so
  // "no attachment" has to be recognised by size as well as by absence.
  if (!(entry instanceof File) || entry.size === 0) return null;

  if (entry.size > MAX_QA_ATTACHMENT_BYTES) {
    throw new UploadValidationError(
      `Attachments must be ${formatFileSize(MAX_QA_ATTACHMENT_BYTES)} or smaller. ` +
        `That one is ${formatFileSize(entry.size)}.`,
      "TOO_LARGE",
    );
  }

  const buffer = Buffer.from(await entry.arrayBuffer());

  const validated = validateUpload({
    filename: entry.name,
    declaredMimeType: entry.type,
    buffer,
  });

  await saveFile(validated.storageKey, buffer);

  return {
    key: validated.storageKey,
    name: validated.originalName,
    mime: validated.mimeType,
    size: validated.sizeBytes,
  };
}
