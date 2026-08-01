/**
 * GET    /api/admin/users/[id] — full profile + sessions + recent activity
 * PATCH  /api/admin/users/[id] — edit details, role, or status
 * DELETE /api/admin/users/[id] — soft delete (?hard=true to purge)
 *
 * The guards that matter — last-admin protection, self-demotion, session
 * revocation on disable — live in `src/lib/users.ts`, so they hold no matter
 * which caller reaches them. This file only handles HTTP.
 *
 * `ctx.params` is a Promise in this version of Next; it must be awaited.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { canViewAdmin, isSuperAdmin } from "@/lib/rbac";
import { adminUpdateUser, deleteUser, getUserById, UserServiceError } from "@/lib/users";
import { adminUpdateUserSchema, formatZodError } from "@/lib/validation";
import { verifyCsrf, csrfError, getIpFromHeaders, getUserAgentFromHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

/** Shared gate: authenticated, and allowed to see the admin area. */
async function requireAdmin() {
  const auth = await getCurrentAuth();

  if (!auth) {
    return { error: NextResponse.json({ message: "Sign in first." }, { status: 401 }) } as const;
  }

  if (!canViewAdmin(auth.user.role)) {
    return { error: NextResponse.json({ message: "Administrators only." }, { status: 403 }) } as const;
  }

  return { auth } as const;
}

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const { id } = await ctx.params;
  const user = await getUserById(id);

  if (!user) {
    return NextResponse.json({ message: "That account no longer exists." }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  if (!verifyCsrf(request)) return csrfError();

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const parsed = adminUpdateUserSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  // REGISTRAR can read the dashboard and toggle status, but must not be able to
  // hand out ADMIN — that would be self-escalation one step removed.
  if (parsed.data.role && !isSuperAdmin(gate.auth.user.role)) {
    return NextResponse.json(
      { message: "Only full administrators can change roles." },
      { status: 403 },
    );
  }

  try {
    const user = await adminUpdateUser(id, parsed.data, {
      actorId: gate.auth.user.id,
      actorName: gate.auth.user.name ?? gate.auth.user.username,
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    });

    return NextResponse.json({ message: "Account updated.", user });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message, field: error.field }, { status: error.status });
    }

    console.error("[api/admin/users PATCH]", error);
    return NextResponse.json({ message: "Could not update the account." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  if (!verifyCsrf(request)) return csrfError();

  // Permanent deletion is a full-admin action; REGISTRAR gets soft delete only.
  const hard = request.nextUrl.searchParams.get("hard") === "true";

  if (hard && !isSuperAdmin(gate.auth.user.role)) {
    return NextResponse.json(
      { message: "Only full administrators can permanently delete." },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;

  try {
    const result = await deleteUser(
      id,
      {
        actorId: gate.auth.user.id,
        actorName: gate.auth.user.name ?? gate.auth.user.username,
        ipAddress: getIpFromHeaders(request.headers),
        userAgent: getUserAgentFromHeaders(request.headers),
      },
      { hard },
    );

    return NextResponse.json({ message: hard ? "Account permanently deleted." : "Account deleted.", ...result });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/admin/users DELETE]", error);
    return NextResponse.json({ message: "Could not delete the account." }, { status: 500 });
  }
}
