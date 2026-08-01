/**
 * Council officer portraits.
 *
 *   POST /api/coesc/officers/[id]/photo — upload/replace. Administrators only.
 *   GET  /api/coesc/officers/[id]/photo — serve it. Any signed-in account.
 *
 * WHY THE PHOTO IS NOT IN `public/`
 * --------------------------------
 * Dropping portraits into `public/` would be less code and would serve them
 * faster. It would also make every one of them readable by anyone on the
 * internet who guessed the filename, with no session required — these are
 * photographs of named students. So they are stored the same way library
 * uploads are: bytes outside the web root, served by this route after an auth
 * check.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { getOfficerPhoto, replaceOfficerPhoto } from "@/lib/coesc";
import { UserServiceError } from "@/lib/users";
import { createFileStream } from "@/lib/storage";
import { verifyCsrf, csrfError } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/coesc/officers/[id]/photo">,
) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in to view the council." }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const photo = await getOfficerPhoto(id);

    if (!photo) {
      return NextResponse.json({ message: "No photo for that seat." }, { status: 404 });
    }

    const nodeStream = createFileStream(photo.key);

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
        "Content-Type": photo.mimeType,
        "Content-Length": String(photo.size),
        // Immutable because the URL carries a version from `photoUpdatedAt`:
        // replacing a photo produces a different URL, so a long cache never
        // shows a stale face.
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[api/coesc/officers/:id/photo] GET", error);
    return NextResponse.json({ message: "Could not load that photo." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/coesc/officers/[id]/photo">,
) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  // A multipart POST from another origin would otherwise upload using this
  // administrator's cookies.
  if (!verifyCsrf(request)) return csrfError();

  const { id } = await ctx.params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: "Could not read the upload." }, { status: 400 });
  }

  const file = form.get("photo");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Choose a photo to upload." }, { status: 400 });
  }

  try {
    const officer = await replaceOfficerPhoto(
      id,
      {
        filename: file.name || "photo.jpg",
        mimeType: file.type || null,
        buffer: Buffer.from(await file.arrayBuffer()),
      },
      { id: auth.user.id, name: auth.user.name, role: auth.user.role },
    );

    return NextResponse.json({ officer });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/coesc/officers/:id/photo] POST", error);
    return NextResponse.json({ message: "Could not save that photo." }, { status: 500 });
  }
}
