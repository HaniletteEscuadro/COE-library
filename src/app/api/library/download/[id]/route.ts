/**
 * GET /api/library/download/[id]
 *
 * Authenticated file download. Files live in `storage/`, outside `public/`, so
 * this route is the only way to reach them — a direct URL guess cannot work,
 * and every retrieval is checked and recorded.
 *
 * Note `await ctx.params`: params are asynchronous in this version of Next.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { recordDownload } from "@/lib/library-social";
import { UserServiceError } from "@/lib/users";
import { createFileStream, fileExists, getFileSize } from "@/lib/storage";
import { getIpFromHeaders, getUserAgentFromHeaders } from "@/lib/security";
import type { ReadableOptions } from "stream";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/library/download/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in to download materials." }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    // Records the download and returns what is needed to serve it. Throws if
    // the material is missing, deleted, or not approved.
    const material = await recordDownload(id, {
      userId: auth.user.id,
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    });

    if (!material.storageKey) {
      return NextResponse.json(
        { message: "This entry is a link, not a stored file." },
        { status: 409 },
      );
    }

    if (!(await fileExists(material.storageKey))) {
      // The row survived but the bytes did not — report it honestly rather
      // than streaming an empty response.
      console.error(`[download] missing file for material ${id}: ${material.storageKey}`);
      return NextResponse.json({ message: "The stored file is missing." }, { status: 410 });
    }

    const size = await getFileSize(material.storageKey);
    const nodeStream = createFileStream(material.storageKey);

    // Stream rather than buffer: a 50 MB video read into memory would be held
    // for the whole request, and a few concurrent downloads would exhaust it.
    const body = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)));
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (error) => controller.error(error));
      },
      cancel() {
        nodeStream.destroy();
      },
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": material.mimeType || "application/octet-stream",
        "Content-Length": String(size),
        // The filename is quoted and stripped of control characters upstream
        // (`sanitizeDisplayName`), so it cannot inject a header.
        "Content-Disposition": `attachment; filename="${material.originalName.replace(/"/g, "")}"`,
        // Private: the response is user-specific and permission-checked.
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/library/download]", error);
    return NextResponse.json({ message: "Could not download the file." }, { status: 500 });
  }
}

// Referenced only to keep the stream typings honest across Node versions.
export type { ReadableOptions };
