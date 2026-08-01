/**
 * GET  /api/notifications — this user's notifications
 * POST /api/notifications — mark read (all, or a specific set of ids)
 *
 * Everything is scoped to the caller inside `library-social.ts`, so one user
 * can neither read nor mark another user's notifications.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { listNotifications, markNotificationsRead } from "@/lib/library-social";
import { getUnreadAnnouncementCount } from "@/lib/announcements";
import { verifyCsrf, csrfError } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  const unreadOnly = request.nextUrl.searchParams.get("unreadOnly") === "true";

  try {
    // Unread announcements are folded into the same badge — a student should
    // not have to watch two separate counters.
    const [notifications, unreadAnnouncements] = await Promise.all([
      listNotifications(auth.user.id, { unreadOnly }),
      getUnreadAnnouncementCount(auth.user.id),
    ]);

    const unread = notifications.filter((item) => !item.readAt).length;

    return NextResponse.json({
      notifications: notifications.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        href: item.href,
        actorName: item.actorName,
        readAt: item.readAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
      unread,
      unreadAnnouncements,
      badge: unread + unreadAnnouncements,
    });
  } catch (error) {
    console.error("[api/notifications] GET", error);
    return NextResponse.json({ message: "Could not load notifications." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // Only accept an array of strings; anything else means "all".
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 200)
    : undefined;

  try {
    return NextResponse.json(await markNotificationsRead(auth.user.id, ids));
  } catch (error) {
    console.error("[api/notifications] POST", error);
    return NextResponse.json({ message: "Could not update notifications." }, { status: 500 });
  }
}
