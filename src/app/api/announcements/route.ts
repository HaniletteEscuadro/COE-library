/**
 * GET  /api/announcements — the shared board (any signed-in account)
 * POST /api/announcements — post a new one (faculty, registrar, admin)
 *
 * Reading is open to everyone by design: the whole requirement is that all
 * users see the same announcements at the same time. Writing is role-gated
 * inside `src/lib/announcements.ts`, so the check cannot be bypassed.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import {
  canPostAnnouncement,
  orgsForRole,
  ANNOUNCEMENT_ORGS,
  createAnnouncement,
  listAnnouncements,
} from "@/lib/announcements";
import { UserServiceError } from "@/lib/users";
import { canModerateAnnouncements } from "@/lib/announcements";
import {
  announcementCreateSchema,
  announcementQuerySchema,
  formatZodError,
} from "@/lib/validation";
import { verifyCsrf, csrfError, getIpFromHeaders, getUserAgentFromHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in to view announcements." }, { status: 401 });
  }

  const parsed = announcementQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  // Expired and deleted rows are moderator-only, whatever the query asks for.
  const includeInactive =
    parsed.data.includeInactive && canModerateAnnouncements(auth.user.role);

  try {
    const result = await listAnnouncements({ ...parsed.data, includeInactive }, auth.user.id);

    return NextResponse.json({
      ...result,
      canPost: canPostAnnouncement(auth.user.role),
      // Every org, so a panel can label a notice it did not publish, plus the
      // subset this account may publish under. The composer is built from
      // `myOrgs`, so the picker cannot even offer an org the server would
      // refuse — and the server refuses it anyway.
      orgs: ANNOUNCEMENT_ORGS.map((o) => ({
        slug: o.slug, name: o.name, short: o.short, course: o.course,
      })),
      myOrgs: orgsForRole(auth.user.role),
      canModerate: canModerateAnnouncements(auth.user.role),
    });
  } catch (error) {
    console.error("[api/announcements] GET", error);
    return NextResponse.json({ message: "Could not load announcements." }, { status: 500 });
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

  const parsed = announcementCreateSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  try {
    const announcement = await createAnnouncement(
      { ...parsed.data, expiresAt: parsed.data.expiresAt || null },
      {
        actorId: auth.user.id,
        actorName: auth.user.name ?? auth.user.username,
        role: auth.user.role,
        ipAddress: getIpFromHeaders(request.headers),
        userAgent: getUserAgentFromHeaders(request.headers),
      },
    );

    return NextResponse.json(
      { message: "Announcement posted.", announcement: { id: announcement.id, title: announcement.title } },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/announcements] POST", error);
    return NextResponse.json({ message: "Could not post the announcement." }, { status: 500 });
  }
}
