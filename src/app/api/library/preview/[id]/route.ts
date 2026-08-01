/**
 * GET /api/library/preview/[id]
 *
 * Streams a stored file for INLINE display — the `<img>`, `<iframe>` and
 * `<video>` sources in the library's preview pane.
 *
 * WHY NOT REUSE /api/library/download/[id]
 * ----------------------------------------
 * That route is deliberately a download: it sends
 * `Content-Disposition: attachment`, which makes a browser save the file rather
 * than render it, and it calls `recordDownload` on every hit. Pointing a
 * preview `<iframe>` at it would both fail to preview and inflate every
 * material's download count each time somebody merely opened the card.
 *
 * So this is the same bytes with two deliberate differences: `inline`, and a
 * view is recorded instead of a download. Authentication and the
 * approved/not-deleted check are identical — `recordView` refuses anything the
 * caller is not allowed to see, so this is not a way around moderation.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { recordView } from "@/lib/library-social";
import { UserServiceError } from "@/lib/users";
import { prisma } from "@/lib/prisma";
import { createFileStream, fileExists, getFileSize } from "@/lib/storage";
import { getIpFromHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * Parse a single-range `Range: bytes=…` header.
 *
 * Only one range is honoured. Multi-range replies need a multipart/byteranges
 * body, which nothing here asks for — PDF.js, `<video>` and `<audio>` all send
 * one range at a time. An unsatisfiable or malformed header returns `null` and
 * the caller sends the whole file, which is what RFC 9110 asks for when a range
 * cannot be honoured (other than an explicitly out-of-bounds one).
 *
 * Returns inclusive offsets, matching both the header and createReadStream.
 */
function parseRange(header: string | null, size: number) {
  if (!header) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;

  let start: number;
  let end: number;

  if (rawStart === "") {
    // "bytes=-500" — the last 500 bytes.
    const wanted = Number(rawEnd);
    if (!Number.isFinite(wanted) || wanted <= 0) return null;
    start = Math.max(0, size - wanted);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Number(rawEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    // A range that runs past the end is clamped, not refused: a client asking
    // for more than exists still wants what is there.
    end = Math.min(end, size - 1);
  }

  // Genuinely outside the file. The caller turns this into a 416.
  if (start >= size || start < 0) return { start, end, unsatisfiable: true as const };
  if (end < start) return null;

  return { start, end, unsatisfiable: false as const };
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/library/preview/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in to view materials." }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    // Throws for a missing, deleted or unapproved material, so the visibility
    // rules are enforced before a single byte is read.
    await recordView(id, {
      userId: auth.user.id,
      ipAddress: getIpFromHeaders(request.headers),
    });

    const material = await prisma.material.findFirst({
      where: { id, deletedAt: null },
      select: { storageKey: true, mimeType: true, originalName: true },
    });

    if (!material) {
      return NextResponse.json({ message: "That material no longer exists." }, { status: 404 });
    }

    if (!material.storageKey) {
      return NextResponse.json(
        { message: "This entry is a link, not a stored file." },
        { status: 409 },
      );
    }

    if (!(await fileExists(material.storageKey))) {
      console.error(`[preview] missing file for material ${id}: ${material.storageKey}`);
      return NextResponse.json({ message: "The stored file is missing." }, { status: 410 });
    }

    const size = await getFileSize(material.storageKey);

    /*
     * Ranged reads.
     *
     * Without these the whole file comes down before anything can be shown. A
     * large PDF is the case that matters: PDF.js fetches the cross-reference
     * table at the end, then only the pages being looked at, so a reader can
     * open page one of a 50 MB document without waiting for the other 49. The
     * same applies to seeking in a lecture video — a `<video>` cannot jump to
     * the middle of a source that will not serve a range.
     */
    const range = parseRange(request.headers.get("range"), size);

    if (range?.unsatisfiable) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }

    const nodeStream = createFileStream(
      material.storageKey,
      range ? { start: range.start, end: range.end } : undefined,
    );

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

    const length = range ? range.end - range.start + 1 : size;

    return new NextResponse(body, {
      status: range ? 206 : 200,
      headers: {
        "Content-Type": material.mimeType || "application/octet-stream",
        "Content-Length": String(length),
        "Content-Disposition": `inline; filename="${material.originalName.replace(/"/g, "")}"`,
        // Advertised whether or not this request used one — a client checks
        // this before deciding to ask.
        "Accept-Ranges": "bytes",
        ...(range
          ? { "Content-Range": `bytes ${range.start}-${range.end}/${size}` }
          : {}),
        // Private: permission-checked and user-specific.
        "Cache-Control": "private, max-age=300",
        // Keeps a file that claims to be a PDF from being sniffed as HTML and
        // executed in the origin that holds everyone's session cookie.
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/library/preview]", error);
    return NextResponse.json({ message: "Could not open the file." }, { status: 500 });
  }
}
