/**
 * POST /api/assignments/[id]/submit — hand in work.
 *
 * Accepts either JSON (typed answer) or multipart (answer + file). The file
 * goes through the same validation and storage path as library uploads, so a
 * renamed executable is rejected here too.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { submitWork } from "@/lib/submissions";
import { UserServiceError } from "@/lib/users";
import { UploadValidationError, validateUpload } from "@/lib/upload";
import { removeFile, saveFile } from "@/lib/storage";
import { submissionCreateSchema, formatZodError } from "@/lib/validation";
import { verifyCsrf, csrfError, getIpFromHeaders, getUserAgentFromHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/assignments/[id]/submit">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in to submit." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  const { id } = await ctx.params;
  const contentType = request.headers.get("content-type") ?? "";

  let content = "";
  let file: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);

    if (!form) {
      return NextResponse.json({ message: "Could not read the upload." }, { status: 400 });
    }

    content = String(form.get("content") ?? "");
    const entry = form.get("file");
    if (entry instanceof File && entry.size > 0) file = entry;
  } else {
    const body = await request.json().catch(() => null);
    const parsed = submissionCreateSchema.safeParse(body ?? {});

    if (!parsed.success) {
      const { message, fieldErrors } = formatZodError(parsed.error);
      return NextResponse.json({ message, fieldErrors }, { status: 400 });
    }

    content = parsed.data.content;
  }

  const actor = {
    actorId: auth.user.id,
    actorName: auth.user.name ?? auth.user.username,
    role: auth.user.role,
    ipAddress: getIpFromHeaders(request.headers),
    userAgent: getUserAgentFromHeaders(request.headers),
  };

  // Bytes are written before the row, and rolled back if the row fails — so a
  // submission can never point at a file that is not there.
  let storageKey: string | null = null;

  try {
    let originalName: string | null = null;
    let mimeType: string | null = null;
    let sizeBytes = 0;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const validated = validateUpload({
        filename: file.name,
        declaredMimeType: file.type,
        buffer,
      });

      await saveFile(validated.storageKey, buffer);

      storageKey = validated.storageKey;
      originalName = validated.originalName;
      mimeType = validated.mimeType;
      sizeBytes = validated.sizeBytes;
    }

    const submission = await submitWork(
      id,
      { content, storageKey, originalName, mimeType, sizeBytes },
      actor,
    );

    return NextResponse.json(
      {
        message: submission.isLate ? "Submitted (marked late)." : "Submitted.",
        submission: {
          id: submission.id,
          status: submission.status,
          isLate: submission.isLate,
          submittedAt: submission.submittedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (storageKey) {
      await removeFile(storageKey).catch(() => {
        /* best effort */
      });
    }

    if (error instanceof UploadValidationError) {
      return NextResponse.json({ message: error.message, code: error.code }, { status: 400 });
    }

    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message, field: error.field }, { status: error.status });
    }

    console.error("[api/assignments/:id/submit]", error);
    return NextResponse.json({ message: "Could not submit your work." }, { status: 500 });
  }
}
