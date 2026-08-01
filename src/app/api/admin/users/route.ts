/**
 * GET  /api/admin/users — search / filter / sort / paginate every account.
 * POST /api/admin/users — create an account directly, with a role.
 *
 * Thin wrappers over `listUsers` / `adminCreateUser`, which already exclude
 * `passwordHash` via an explicit select. The role gate is enforced here rather
 * than in the UI: hiding a nav link is not access control.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { canViewAdmin, isSuperAdmin } from "@/lib/rbac";
import { adminCreateUser, listUsers, getDashboardStats, UserServiceError } from "@/lib/users";
import { adminCreateUserSchema, adminUserQuerySchema, formatZodError } from "@/lib/validation";
import { verifyCsrf, csrfError, getIpFromHeaders, getUserAgentFromHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!canViewAdmin(auth.user.role)) {
    return NextResponse.json({ message: "Administrators only." }, { status: 403 });
  }

  const parsed = adminUserQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  try {
    const [result, stats] = await Promise.all([listUsers(parsed.data), getDashboardStats()]);

    return NextResponse.json({
      ...result,
      stats,
      // The dashboard needs to know which controls to offer. A REGISTRAR may
      // read the list and toggle status but not hand out roles or purge, so
      // the UI has to be able to tell the two apart.
      canManageRoles: isSuperAdmin(auth.user.role),
      viewerId: auth.user.id,
    });
  } catch (error) {
    console.error("[api/admin/users]", error);
    return NextResponse.json({ message: "Could not load accounts." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!canViewAdmin(auth.user.role)) {
    return NextResponse.json({ message: "Administrators only." }, { status: 403 });
  }

  if (!verifyCsrf(request)) return csrfError();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const parsed = adminCreateUserSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  // Same rule as PATCH: a REGISTRAR must not be able to mint an ADMIN, which
  // would be self-escalation one step removed.
  if (parsed.data.role !== "STUDENT" && !isSuperAdmin(auth.user.role)) {
    return NextResponse.json(
      { message: "Only full administrators can create an account with a role." },
      { status: 403 },
    );
  }

  try {
    const user = await adminCreateUser(parsed.data, {
      actorId: auth.user.id,
      actorName: auth.user.name ?? auth.user.username,
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    });

    return NextResponse.json({ message: "Account created.", user }, { status: 201 });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json(
        { message: error.message, fieldErrors: error.field ? { [error.field]: error.message } : {} },
        { status: error.status },
      );
    }

    console.error("[api/admin/users POST]", error);
    return NextResponse.json({ message: "Could not create the account." }, { status: 500 });
  }
}
