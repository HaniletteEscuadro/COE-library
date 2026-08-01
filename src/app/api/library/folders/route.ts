/**
 * GET  /api/library/folders  — the whole folder tree, with rolled-up counts
 * POST /api/library/folders  — create a folder (admins only)
 *
 * The tree is identical for every account. Counts are rolled up from
 * descendants in `getFolderTree`, so a course node shows everything beneath it.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { createFolder, getFolderTree, getLibraryStats } from "@/lib/library";
import { UserServiceError } from "@/lib/users";
import { folderCreateSchema, formatZodError } from "@/lib/validation";
import { verifyCsrf, csrfError, getIpFromHeaders, getUserAgentFromHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in to browse the library." }, { status: 401 });
  }

  try {
    // Both are cheap and always rendered together by the sidebar.
    const [folders, stats] = await Promise.all([getFolderTree(), getLibraryStats()]);
    return NextResponse.json({ folders, stats });
  } catch (error) {
    console.error("[api/library/folders]", error);
    return NextResponse.json({ message: "Could not load folders." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!verifyCsrf(request)) {
    return csrfError();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const parsed = folderCreateSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  try {
    // The role check lives in `createFolder`, so it cannot be bypassed by any
    // other caller of that function.
    const folder = await createFolder(parsed.data, {
      actorId: auth.user.id,
      actorName: auth.user.name ?? auth.user.username,
      role: auth.user.role,
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    });

    return NextResponse.json({ message: "Folder created.", folder }, { status: 201 });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/library/folders] POST", error);
    return NextResponse.json({ message: "Could not create the folder." }, { status: 500 });
  }
}
