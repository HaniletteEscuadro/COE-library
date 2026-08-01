/**
 * GET /api/admin/logs — the activity feed.
 *
 * Backs the initial render of the admin log panel; live entries after that
 * arrive over Socket.IO, so this is only fetched once per page load.
 *
 * Every row carries the full context the brief requires: user id, username,
 * email, action, timestamp, IP, device, browser and OS.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { canViewAdmin } from "@/lib/rbac";
import { listLoginEvents } from "@/lib/users";
import { adminLogQuerySchema, formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!canViewAdmin(auth.user.role)) {
    return NextResponse.json({ message: "Administrators only." }, { status: 403 });
  }

  const parsed = adminLogQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  try {
    return NextResponse.json(await listLoginEvents(parsed.data));
  } catch (error) {
    console.error("[api/admin/logs]", error);
    return NextResponse.json({ message: "Could not load the activity log." }, { status: 500 });
  }
}
