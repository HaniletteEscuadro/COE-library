/**
 * PATCH /api/coesc/applications/[id] — approve or reject.
 *
 * ADMIN or REGISTRAR. `reviewApplication` owns the permission check and also
 * notifies the applicant, so neither can be forgotten at a call site.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { reviewApplication } from "@/lib/coesc";
import { UserServiceError } from "@/lib/users";
import { applicationReviewSchema, formatZodError } from "@/lib/validation";
import { verifyCsrf, csrfError } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/coesc/applications/[id]">,
) {
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

  const parsed = applicationReviewSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  try {
    const application = await reviewApplication(id, parsed.data, {
      id: auth.user.id,
      name: auth.user.name,
      role: auth.user.role,
    });

    return NextResponse.json({ application });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/coesc/applications/:id] PATCH", error);
    return NextResponse.json({ message: "Could not save that decision." }, { status: 500 });
  }
}
