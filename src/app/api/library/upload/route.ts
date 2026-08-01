/**
 * POST /api/library/upload
 *
 * Multipart upload for the shared Engineering Library. This is the route that
 * replaces the old localStorage approach, where every file was base64-encoded
 * into a ~5 MB per-browser quota and was invisible to everyone else.
 *
 * Order of operations matters: authenticate, then validate, then write to disk,
 * then write to the database. The file is only ever written after validation
 * passes, and the database row is only written after the bytes are safely on
 * disk — so a failure can never leave a Material row pointing at a file that
 * does not exist.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { verifyCsrf, csrfError } from "@/lib/security";
import { createMaterial, canUpload } from "@/lib/library";
import { UserServiceError } from "@/lib/users";
import {
  MAX_FILES_PER_UPLOAD,
  UploadValidationError,
  formatFileSize,
  validateBatch,
  validateUpload,
} from "@/lib/upload";
import { removeFile, saveFile } from "@/lib/storage";
import { materialUploadSchema, formatZodError } from "@/lib/validation";
import { getIpFromHeaders, getUserAgentFromHeaders } from "@/lib/security";

// Uploads read the request body and the session — never prerender or cache.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // --- 1. Authenticate ---------------------------------------------------
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in to upload materials." }, { status: 401 });
  }

  if (!canUpload(auth.user.role)) {
    return NextResponse.json(
      { message: "Your account does not have permission to upload." },
      { status: 403 },
    );
  }

  // --- 2. CSRF -----------------------------------------------------------
  // A multipart POST from another origin would otherwise be able to upload
  // using this user's cookies.
  if (!verifyCsrf(request)) {
    return csrfError();
  }

  // --- 3. Parse the form -------------------------------------------------
  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { message: "Could not read the upload. Try again." },
      { status: 400 },
    );
  }

  const parsed = materialUploadSchema.safeParse({
    folderId: form.get("folderId"),
    title: form.get("title"),
    description: form.get("description") ?? "",
    kind: form.get("kind") ?? undefined,
    semester: form.get("semester") ?? "",
    professor: form.get("professor") ?? "",
    tags: form.get("tags") ?? "",
    externalUrl: form.get("externalUrl") ?? "",
  });

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  const fields = parsed.data;
  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);

  // A link-only entry (Drive / YouTube) has no file attached.
  if (files.length === 0 && !fields.externalUrl) {
    return NextResponse.json(
      { message: "Attach a file or paste a link.", fieldErrors: { files: "Required" } },
      { status: 400 },
    );
  }

  const ipAddress = getIpFromHeaders(request.headers);
  const userAgent = getUserAgentFromHeaders(request.headers);
  const actor = {
    actorId: auth.user.id,
    actorName: auth.user.name ?? auth.user.username,
    role: auth.user.role,
    ipAddress,
    userAgent,
  };

  // --- 4. Link-only upload ------------------------------------------------
  if (files.length === 0 && fields.externalUrl) {
    try {
      const material = await createMaterial(
        {
          folderId: fields.folderId,
          title: fields.title,
          description: fields.description,
          kind: fields.kind === "OTHER" ? "LINK" : fields.kind,
          originalName: fields.title,
          externalUrl: fields.externalUrl,
          mimeType: "text/uri-list",
          sizeBytes: 0,
          tags: fields.tags,
          semester: fields.semester,
          professor: fields.professor,
        },
        actor,
      );

      return NextResponse.json({ message: "Link added.", materials: [{ id: material.id, title: material.title }] }, { status: 201 });
    } catch (error) {
      return toErrorResponse(error);
    }
  }

  // --- 5. File upload -----------------------------------------------------
  try {
    validateBatch(files.map((file) => ({ size: file.size })));
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ message: error.message, code: error.code }, { status: 413 });
    }
    throw error;
  }

  const created: Array<{ id: string; title: string; sizeBytes: number }> = [];
  const failed: Array<{ name: string; reason: string }> = [];
  // Tracked so a database failure does not orphan bytes on disk.
  const writtenKeys: string[] = [];

  for (const file of files) {
    let storageKey: string | null = null;

    try {
      const buffer = Buffer.from(await file.arrayBuffer());

      // Reads magic bytes — a renamed executable is rejected here, not by the
      // extension it claims.
      const validated = validateUpload({
        filename: file.name,
        declaredMimeType: file.type,
        buffer,
      });

      await saveFile(validated.storageKey, buffer);
      storageKey = validated.storageKey;
      writtenKeys.push(validated.storageKey);

      const material = await createMaterial(
        {
          folderId: fields.folderId,
          // A single-file upload uses the typed title; a batch keeps each
          // filename so the cards remain distinguishable.
          title: files.length === 1 ? fields.title : validated.originalName,
          description: fields.description,
          kind: fields.kind === "OTHER" ? (validated.kind as never) : fields.kind,
          originalName: validated.originalName,
          storageKey: validated.storageKey,
          mimeType: validated.mimeType,
          extension: validated.extension,
          sizeBytes: validated.sizeBytes,
          checksum: validated.checksum,
          tags: fields.tags,
          semester: fields.semester,
          professor: fields.professor,
        },
        actor,
      );

      created.push({ id: material.id, title: material.title, sizeBytes: validated.sizeBytes });
    } catch (error) {
      // Roll back this file's bytes; the others in the batch are unaffected.
      if (storageKey) {
        await removeFile(storageKey).catch(() => {
          /* best effort */
        });
      }

      failed.push({
        name: file.name,
        reason:
          error instanceof UploadValidationError || error instanceof UserServiceError
            ? error.message
            : "Could not be saved.",
      });
    }
  }

  if (created.length === 0) {
    return NextResponse.json(
      { message: failed[0]?.reason ?? "Upload failed.", failed },
      { status: 400 },
    );
  }

  const totalBytes = created.reduce((sum, item) => sum + item.sizeBytes, 0);

  return NextResponse.json(
    {
      message:
        created.length === 1
          ? `"${created[0].title}" uploaded (${formatFileSize(created[0].sizeBytes)}).`
          : `${created.length} materials uploaded (${formatFileSize(totalBytes)}).`,
      materials: created,
      failed,
    },
    { status: 201 },
  );
}

/** Map a service error onto its intended status; anything else is a 500. */
function toErrorResponse(error: unknown) {
  if (error instanceof UserServiceError) {
    return NextResponse.json(
      { message: error.message, field: error.field },
      { status: error.status },
    );
  }

  console.error("[api/library/upload]", error);

  return NextResponse.json({ message: "Something went wrong. Try again." }, { status: 500 });
}

/** Surface the batch limit to the client without hard-coding it there. */
export async function GET() {
  return NextResponse.json({ maxFiles: MAX_FILES_PER_UPLOAD });
}
