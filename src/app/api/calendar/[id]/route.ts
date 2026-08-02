/**
 * PATCH  /api/calendar/[id] — tick one off, or un-tick it
 * DELETE /api/calendar/[id] — remove one
 *
 * Both scope on the session's own user id inside `src/lib/calendar.ts`, so a
 * guessed id belonging to another account resolves to "no such entry" rather
 * than to somebody else's plan.
 *
 * `ctx.params` is a Promise in this version of Next and must be awaited.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { verifyCsrf, csrfError } from "@/lib/security";
import { deleteCalendarEntry, setCalendarEntryDone } from "@/lib/calendar";
import { UserServiceError } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/calendar/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  const { id } = await ctx.params;

  let body: { done?: unknown } = {};
  try {
    body = (await request.json()) as { done?: unknown };
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.done !== "boolean") {
    return NextResponse.json({ message: "Send { done: true | false }." }, { status: 400 });
  }

  try {
    const result = await setCalendarEntryDone(auth.user.id, id, body.done);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "PATCH");
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/calendar/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  const { id } = await ctx.params;

  try {
    const result = await deleteCalendarEntry(auth.user.id, id);
    return NextResponse.json({ message: "Removed.", ...result });
  } catch (error) {
    return toErrorResponse(error, "DELETE");
  }
}

function toErrorResponse(error: unknown, method: string) {
  if (error instanceof UserServiceError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }

  console.error(`[api/calendar/:id] ${method}`, error);
  return NextResponse.json({ message: "Something went wrong. Try again." }, { status: 500 });
}
