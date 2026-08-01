/**
 * GET  /api/coesc/applications — list. Reviewers see all; a student sees only
 *                                their own. The scope is decided server-side in
 *                                `listApplications`, never from a query param.
 * POST /api/coesc/applications — apply to a committee. Any signed-in account.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { createApplication, listApplications } from "@/lib/coesc";
import { UserServiceError } from "@/lib/users";
import { committeeApplicationSchema, formatZodError } from "@/lib/validation";
import { verifyCsrf, csrfError } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  const url = new URL(request.url);

  try {
    const result = await listApplications(
      { id: auth.user.id, name: auth.user.name, role: auth.user.role },
      {
        status: url.searchParams.get("status") ?? undefined,
        committee: url.searchParams.get("committee") ?? undefined,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/coesc/applications] GET", error);
    return NextResponse.json({ message: "Could not load applications." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in to apply." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const parsed = committeeApplicationSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  try {
    const application = await createApplication(parsed.data, {
      id: auth.user.id,
      name: auth.user.name,
      role: auth.user.role,
    });

    return NextResponse.json(
      { message: "Application sent. The council will review it.", application },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json(
        { message: error.message, fieldErrors: error.field ? { [error.field]: error.message } : {} },
        { status: error.status },
      );
    }

    console.error("[api/coesc/applications] POST", error);
    return NextResponse.json({ message: "Could not send that application." }, { status: 500 });
  }
}
