/**
 * PATCH  /api/announcements/[id] — edit (author or moderator)
 * DELETE /api/announcements/[id] — soft delete (author or moderator)
 * POST   /api/announcements/[id] — mark as read (any signed-in account)
 *
 * `ctx.params` is a Promise in this version of Next and must be awaited.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import {
  deleteAnnouncement,
  markAnnouncementRead,
  updateAnnouncement,
} from "@/lib/announcements";
import { UserServiceError } from "@/lib/users";
import { announcementUpdateSchema, formatZodError } from "@/lib/validation";
import { verifyCsrf, csrfError, getIpFromHeaders, getUserAgentFromHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

/** Marking read is a per-user write, so it needs no role check. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/announcements/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const result = await markAnnouncementRead(id, auth.user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/announcements/:id] POST", error);
    return NextResponse.json({ message: "Could not mark as read." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/announcements/[id]">) {
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

  const parsed = announcementUpdateSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  try {
    const announcement = await updateAnnouncement(id, parsed.data, {
      actorId: auth.user.id,
      actorName: auth.user.name ?? auth.user.username,
      role: auth.user.role,
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    });

    return NextResponse.json({ message: "Announcement updated.", id: announcement.id });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/announcements/:id] PATCH", error);
    return NextResponse.json({ message: "Could not update the announcement." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/announcements/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  const { id } = await ctx.params;

  try {
    await deleteAnnouncement(id, {
      actorId: auth.user.id,
      actorName: auth.user.name ?? auth.user.username,
      role: auth.user.role,
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    });

    return NextResponse.json({ message: "Announcement deleted." });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/announcements/:id] DELETE", error);
    return NextResponse.json({ message: "Could not delete the announcement." }, { status: 500 });
  }
}
