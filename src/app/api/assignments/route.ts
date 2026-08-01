/**
 * GET  /api/assignments — the class list (any signed-in account)
 * POST /api/assignments — post one (faculty, registrar, admin)
 *
 * Each row carries only the *viewer's own* submission summary. A student
 * calling this can never receive another student's work — see `listAssignments`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { createAssignment, listAssignments } from "@/lib/submissions";
import { UserServiceError } from "@/lib/users";
import { assignmentCreateSchema, assignmentQuerySchema, formatZodError } from "@/lib/validation";
import { verifyCsrf, csrfError, getIpFromHeaders, getUserAgentFromHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in to view assignments." }, { status: 401 });
  }

  const parsed = assignmentQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await listAssignments(parsed.data, { id: auth.user.id, role: auth.user.role }),
    );
  } catch (error) {
    console.error("[api/assignments] GET", error);
    return NextResponse.json({ message: "Could not load assignments." }, { status: 500 });
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

  const parsed = assignmentCreateSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  try {
    const assignment = await createAssignment(
      { ...parsed.data, dueAt: parsed.data.dueAt || null },
      {
        actorId: auth.user.id,
        actorName: auth.user.name ?? auth.user.username,
        role: auth.user.role,
        ipAddress: getIpFromHeaders(request.headers),
        userAgent: getUserAgentFromHeaders(request.headers),
      },
    );

    return NextResponse.json(
      { message: "Assignment posted.", assignment: { id: assignment.id, title: assignment.title } },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/assignments] POST", error);
    return NextResponse.json({ message: "Could not post the assignment." }, { status: 500 });
  }
}
