/**
 * PATCH /api/coesc/officers/[id] — rename the holder of a council seat.
 *
 * Administrators only. The permission check itself is in `updateOfficer`, so a
 * future route reaching the same function cannot skip it.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { updateOfficer } from "@/lib/coesc";
import { UserServiceError } from "@/lib/users";
import { councilOfficerUpdateSchema, formatZodError } from "@/lib/validation";
import { verifyCsrf, csrfError } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/coesc/officers/[id]">) {
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

  const parsed = councilOfficerUpdateSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  try {
    const officer = await updateOfficer(id, parsed.data, {
      id: auth.user.id,
      name: auth.user.name,
      role: auth.user.role,
    });

    return NextResponse.json({ officer });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/coesc/officers/:id] PATCH", error);
    return NextResponse.json({ message: "Could not update that seat." }, { status: 500 });
  }
}
