/**
 * GET /api/qa/attachment/question/[id]
 * GET /api/qa/attachment/answer/[id]
 *
 * Streams the photo or file attached to a question or an answer.
 *
 * Modelled on the library's preview route, and for the same reason: the bytes
 * live under STORAGE_DIR, deliberately outside `public/`. Anything in `public/`
 * is served by Next with no auth check, so a Q&A attachment placed there would
 * be readable by anyone who guessed the URL — including the photo of a marked
 * exam paper a student attached to a question about it.
 *
 * Who may read what is decided by `resolveAttachment` in `src/lib/qa.ts`, next
 * to the rules that decide who may read the question itself, so the download
 * and the page linking to it cannot drift apart.
 *
 * `ctx.params` is a Promise in this version of Next and must be awaited.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { resolveAttachment } from "@/lib/qa";
import { createFileStream, fileExists, getFileSize } from "@/lib/storage";
import type { ReadableStream as WebReadableStream } from "stream/web";
import { Readable } from "stream";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/qa/attachment/[type]/[id]">,
) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  const { type, id } = await ctx.params;

  if (type !== "question" && type !== "answer") {
    return NextResponse.json({ message: "Unknown attachment type." }, { status: 400 });
  }

  const found = await resolveAttachment(type, id, { id: auth.user.id, role: auth.user.role });

  /*
   * 404, not 403, when the viewer may not see it.
   *
   * `resolveAttachment` returns null both for "no such attachment" and for
   * "not yours to read", and the two answer identically on purpose: a 403
   * would confirm that a particular pending answer exists, which is precisely
   * what the pending state is hiding.
   */
  if (!found) {
    return NextResponse.json({ message: "That attachment is not available." }, { status: 404 });
  }

  if (!(await fileExists(found.key))) {
    // The row survived and the bytes did not — the shape of a deploy that lost
    // its volume. Say so plainly rather than streaming an empty body.
    console.error("[api/qa/attachment] missing file for", type, id, found.key);
    return NextResponse.json({ message: "That file is no longer on the server." }, { status: 410 });
  }

  const size = await getFileSize(found.key);
  const stream = createFileStream(found.key);

  return new NextResponse(Readable.toWeb(stream) as WebReadableStream<Uint8Array> as ReadableStream, {
    headers: {
      "Content-Type": found.mime,
      "Content-Length": String(size),
      // `inline`, so an image or a PDF opens in the viewer rather than
      // downloading — the point is to read the question, not to collect files.
      "Content-Disposition": `inline; filename="${found.name.replace(/["\\]/g, "")}"`,
      // Private: this response is scoped to one account's permissions, so a
      // shared cache must never hand it to the next person.
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
