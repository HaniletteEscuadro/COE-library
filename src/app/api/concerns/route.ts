/**
 * GET  /api/concerns — the board, as this account is allowed to see it
 * POST /api/concerns — raise one (any signed-in account)
 *
 * The response shape differs by role and that is the point: a student receives
 * approved and addressed concerns with no author on them, an administrator
 * receives everything including who raised each one. Both are built in
 * `src/lib/concerns.ts`; this route does not decide it.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { verifyCsrf, csrfError, getIpFromHeaders, getUserAgentFromHeaders } from "@/lib/security";
import { createConcern, listConcerns } from "@/lib/concerns";
import { UserServiceError } from "@/lib/users";
import { concernCreateSchema, formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in to see the board." }, { status: 401 });
  }

  try {
    const result = await listConcerns(
      { id: auth.user.id, role: auth.user.role },
      {
        status: request.nextUrl.searchParams.get("status") ?? undefined,
        category: request.nextUrl.searchParams.get("category") ?? undefined,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/concerns] GET", error);
    return NextResponse.json({ message: "Could not load the board." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const parsed = concernCreateSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  try {
    // The response is the *public* shape even for the person who just wrote it:
    // there is no reason to echo an identity back, and not doing so means no
    // code path returns one to a student.
    const concern = await createConcern(parsed.data, {
      actorId: auth.user.id,
      actorName: auth.user.name ?? auth.user.username,
      role: auth.user.role,
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    });

    return NextResponse.json(
      { message: "Sent for review. An administrator will look at it.", concern },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json(
        { message: error.message, field: error.field },
        { status: error.status },
      );
    }

    console.error("[api/concerns] POST", error);
    return NextResponse.json({ message: "Could not send that. Try again." }, { status: 500 });
  }
}
