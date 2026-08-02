/**
 * GET    /api/calendar        — my own entries
 * POST   /api/calendar        — add one
 * DELETE /api/calendar?scope= — clear mine in bulk ("past" | "done" | "all")
 *
 * Every handler scopes on the session's own user id and takes no user
 * parameter, so there is no shape of request that reads or clears somebody
 * else's calendar. See src/lib/calendar.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { verifyCsrf, csrfError } from "@/lib/security";
import {
  clearCalendarEntries,
  createCalendarEntry,
  listCalendarEntries,
} from "@/lib/calendar";
import { UserServiceError } from "@/lib/users";
import { calendarEntryCreateSchema, formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in to see your calendar." }, { status: 401 });
  }

  try {
    const result = await listCalendarEntries(auth.user.id, {
      from: request.nextUrl.searchParams.get("from") ?? undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/calendar] GET", error);
    return NextResponse.json({ message: "Could not load your calendar." }, { status: 500 });
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

  const parsed = calendarEntryCreateSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  try {
    const entry = await createCalendarEntry(auth.user.id, parsed.data);
    return NextResponse.json({ message: "Added to your calendar.", entry }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "POST");
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  const scope = request.nextUrl.searchParams.get("scope") ?? "past";

  if (scope !== "all" && scope !== "past" && scope !== "done") {
    return NextResponse.json({ message: "Unknown clear scope." }, { status: 400 });
  }

  /*
   * "Today" comes from the client.
   *
   * The server runs in UTC and the students are in UTC+8, so a server-side
   * `new Date()` would treat everything up to 08:00 local as still yesterday —
   * and "clear past entries" tapped at breakfast would delete today's plans.
   * The browser knows which day it is for the person pressing the button.
   */
  const today = request.nextUrl.searchParams.get("today") ?? "";

  try {
    const result = await clearCalendarEntries(auth.user.id, scope, today);
    return NextResponse.json({
      message:
        result.cleared === 0
          ? "Nothing to clear."
          : `Cleared ${result.cleared} ${result.cleared === 1 ? "entry" : "entries"}.`,
      ...result,
    });
  } catch (error) {
    return toErrorResponse(error, "DELETE");
  }
}

function toErrorResponse(error: unknown, method: string) {
  if (error instanceof UserServiceError) {
    return NextResponse.json(
      { message: error.message, field: error.field },
      { status: error.status },
    );
  }

  console.error(`[api/calendar] ${method}`, error);
  return NextResponse.json({ message: "Something went wrong. Try again." }, { status: 500 });
}
