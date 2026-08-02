/**
 * GET    /api/concerns/[id] — one concern with its author (administrators only)
 * PATCH  /api/concerns/[id] — approve, mark addressed, or write a response
 * DELETE /api/concerns/[id] — reject (soft delete)
 *
 * All three are administrator-only, enforced in `src/lib/concerns.ts`. The GET
 * is separate from the list route precisely because it returns the identified
 * shape: keeping it on its own path makes "this endpoint reveals who wrote it"
 * a property of one URL rather than a flag on a shared one.
 *
 * `ctx.params` is a Promise in this version of Next and must be awaited.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { verifyCsrf, csrfError, getIpFromHeaders, getUserAgentFromHeaders } from "@/lib/security";
import { deleteConcern, getConcernForModerator, reviewConcern } from "@/lib/concerns";
import { UserServiceError } from "@/lib/users";
import { concernReviewSchema, formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/concerns/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const concern = await getConcernForModerator(id, auth.user.role);
    return NextResponse.json({ concern });
  } catch (error) {
    return toErrorResponse(error, "GET");
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/concerns/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const parsed = concernReviewSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  try {
    const concern = await reviewConcern(id, parsed.data, {
      actorId: auth.user.id,
      actorName: auth.user.name ?? auth.user.username,
      role: auth.user.role,
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    });

    return NextResponse.json({ message: "Concern updated.", concern });
  } catch (error) {
    return toErrorResponse(error, "PATCH");
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/concerns/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  const { id } = await ctx.params;

  try {
    const result = await deleteConcern(id, {
      actorId: auth.user.id,
      actorName: auth.user.name ?? auth.user.username,
      role: auth.user.role,
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    });

    return NextResponse.json({ message: "Concern rejected.", ...result });
  } catch (error) {
    return toErrorResponse(error, "DELETE");
  }
}

function toErrorResponse(error: unknown, method: string) {
  if (error instanceof UserServiceError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }

  console.error(`[api/concerns/:id] ${method}`, error);
  return NextResponse.json({ message: "Something went wrong. Try again." }, { status: 500 });
}
