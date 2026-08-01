/**
 * Announcements — one shared board.
 *
 * There is no per-user copy of anything here. Every signed-in account reads the
 * same rows, so "everyone sees the new announcement" is a property of the data
 * model rather than something the UI has to keep in sync.
 *
 * Nothing in this file imports `next/*`.
 */

import { prisma } from "@/lib/prisma";
import { emitRealtime } from "@/lib/realtime";
import { recordAuditLog } from "@/lib/audit";
import { UserServiceError, type ActorContext } from "@/lib/users";
import { ACADEMIC_STAFF_ROLES, ADMIN_ROLES, hasRole } from "@/lib/rbac";
import type { UserRole } from "@/lib/enums";

/** Who may post to the board. Students read only. */
/**
 * Who may post.
 *
 * Academic staff, plus the two student-organisation officer roles — publishing
 * their org's notices is the whole reason those roles exist in the portal.
 * They can post; `canModerateAnnouncements` below still keeps them from
 * editing or deleting anyone else's.
 */
const ANNOUNCER_ROLES = [
  ...ACADEMIC_STAFF_ROLES,
  "ORG_OFFICER_PICE",
  "ORG_OFFICER_IIEE",
] as const satisfies readonly UserRole[];

export function canPostAnnouncement(role: string | null | undefined) {
  return hasRole(role, ANNOUNCER_ROLES);
}

// ---------------------------------------------------------------------------
// Organisations
// ---------------------------------------------------------------------------

/**
 * The bodies that can publish, and who may publish as each.
 *
 * `null` — the whole college. Staff only; a notice with no org is the loudest
 * thing on the board and is not an org officer's to send.
 *
 * The important rule is the last two rows: a PICE officer may publish as PICE
 * and nothing else. Without that check anyone holding an officer role could
 * post in the other org's name, which is worse than not having org notices at
 * all — the board is the one place students trust to be official.
 */
export const ANNOUNCEMENT_ORGS = [
  {
    slug: "COESC",
    name: "COE Student Council",
    short: "COESC",
    /** Course whose students this org represents; null = the whole college. */
    course: null as string | null,
    roles: [...ACADEMIC_STAFF_ROLES] as readonly string[],
  },
  {
    slug: "PICE",
    name: "Philippine Institute of Civil Engineers",
    short: "PICE",
    course: "CE",
    roles: [...ADMIN_ROLES, "ORG_OFFICER_PICE"] as readonly string[],
  },
  {
    slug: "IIEE",
    name: "Institute of Integrated Electrical Engineers",
    short: "IIEE",
    course: "EE",
    roles: [...ADMIN_ROLES, "ORG_OFFICER_IIEE"] as readonly string[],
  },
] as const;

export type AnnouncementOrg = (typeof ANNOUNCEMENT_ORGS)[number]["slug"];

/** Normalise anything a client sends into a known org slug, or null. */
export function normalizeOrg(value: string | null | undefined): string | null {
  const upper = String(value ?? "").trim().toUpperCase();
  if (!upper) return null;
  return ANNOUNCEMENT_ORGS.some((o) => o.slug === upper) ? upper : null;
}

/**
 * May this role publish under this org?
 *
 * `org === null` means a college-wide notice, which only academic staff may
 * send. An unknown slug is refused rather than treated as college-wide, so a
 * typo cannot silently escalate a PICE notice into one addressed to everybody.
 */
export function canPostToOrg(role: string | null | undefined, org: string | null) {
  if (!canPostAnnouncement(role)) return false;

  if (org === null) {
    return hasRole(role, ACADEMIC_STAFF_ROLES);
  }

  const target = ANNOUNCEMENT_ORGS.find((o) => o.slug === org);
  if (!target) return false;

  return Boolean(role && target.roles.includes(role));
}

/** Every org this role may publish under, for building the composer's picker. */
export function orgsForRole(role: string | null | undefined) {
  return ANNOUNCEMENT_ORGS.filter((org) => canPostToOrg(role, org.slug)).map((org) => ({
    slug: org.slug,
    name: org.name,
    short: org.short,
    course: org.course,
  }));
}

/** Who may edit or remove someone else's post. */
export function canModerateAnnouncements(role: string | null | undefined) {
  return hasRole(role, ADMIN_ROLES);
}

const AUTHOR_SELECT = {
  select: { id: true, name: true, username: true, role: true, image: true },
} as const;

/** Serialise for the wire, resolving the author's display name. */
function toRealtime(row: {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  course: string | null;
  year: string | null;
  org: string | null;
  pinned: boolean;
  authorId: string | null;
  publishedAt: Date;
  expiresAt: Date | null;
  author?: { name: string | null; username: string | null } | null;
}) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    priority: row.priority,
    course: row.course,
    year: row.year,
    org: row.org,
    pinned: row.pinned,
    authorId: row.authorId,
    authorName: row.author?.name ?? row.author?.username ?? null,
    publishedAt: row.publishedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type AnnouncementQuery = {
  search?: string;
  category?: string;
  course?: string;
  year?: string;
  /**
   * Narrow to one organisation's board.
   *
   * "COESC" gives the council's notices plus the college-wide ones, so an org
   * panel is never an empty box just because the last notice went out to
   * everybody. Passing nothing returns the whole board, unchanged.
   */
  org?: string;
  /** Moderators only — includes expired and soft-deleted rows. */
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
};

/**
 * The board, newest first with pinned posts on top.
 *
 * `viewerId` is only used to attach each row's read state; it never changes
 * *which* rows come back. Everyone sees the same set.
 */
export async function listAnnouncements(query: AnnouncementQuery, viewerId?: string | null) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const now = new Date();

  const where = {
    ...(query.includeInactive
      ? {}
      : {
          deletedAt: null,
          // Either no expiry, or not yet expired.
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        }),
    ...(query.category ? { category: query.category } : {}),
    // A post scoped to a course is still shown to everyone when the viewer has
    // not filtered; scoping narrows, it does not hide.
    ...(query.course ? { OR: [{ course: null }, { course: query.course }] } : {}),
    ...(query.year ? { OR: [{ year: null }, { year: query.year }] } : {}),
    // Same idea as `course`: an org filter narrows to that org plus the notices
    // addressed to everyone, rather than hiding college-wide news from a panel.
    ...(normalizeOrg(query.org)
      ? { AND: [{ OR: [{ org: null }, { org: normalizeOrg(query.org) }] }] }
      : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search } },
            { body: { contains: query.search } },
          ],
        }
      : {}),
  };

  const [rows, total, unreadCount] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        author: AUTHOR_SELECT.select ? { select: AUTHOR_SELECT.select } : undefined,
        // Only the viewer's own receipt, so the payload stays small.
        reads: viewerId ? { where: { userId: viewerId }, select: { readAt: true } } : false,
      },
    }),
    prisma.announcement.count({ where }),
    viewerId
      ? prisma.announcement.count({
          where: {
            deletedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            reads: { none: { userId: viewerId } },
          },
        })
      : Promise.resolve(0),
  ]);

  return {
    announcements: rows.map((row) => ({
      ...toRealtime(row),
      authorRole: row.author?.role ?? null,
      readByMe: Array.isArray(row.reads) && row.reads.length > 0,
      readCount: row.readCount,
      createdAt: row.createdAt.toISOString(),
    })),
    total,
    unreadCount,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getAnnouncement(id: string) {
  return prisma.announcement.findFirst({
    where: { id, deletedAt: null },
    include: { author: { select: AUTHOR_SELECT.select } },
  });
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export async function createAnnouncement(
  input: {
    title: string;
    body: string;
    category?: string;
    priority?: string;
    course?: string;
    year?: string;
    /** "COESC" | "PICE" | "IIEE", or blank for a college-wide notice. */
    org?: string | null;
    pinned?: boolean;
    expiresAt?: string | null;
  },
  actor: ActorContext & { role?: string | null },
) {
  if (!canPostAnnouncement(actor.role)) {
    throw new UserServiceError("You do not have permission to post announcements.", 403);
  }

  /*
   * Which org this goes out under.
   *
   * Normalised first, then checked: an unrecognised slug becomes null, and null
   * means "the whole college", which only academic staff may send. So a
   * misspelled or invented org cannot quietly widen a post's audience — it is
   * refused here instead.
   *
   * This is the check that stops a PICE officer publishing in IIEE's name.
   */
  const org = normalizeOrg(input.org);

  if (!canPostToOrg(actor.role, org)) {
    throw new UserServiceError(
      org
        ? `You cannot post announcements as ${org}.`
        : "Only staff can post an announcement to the whole college. Choose your organisation.",
      403,
    );
  }

  // Pinning is a curation decision, not an authoring one.
  if (input.pinned && !canModerateAnnouncements(actor.role)) {
    throw new UserServiceError("Only administrators can pin announcements.", 403);
  }

  const announcement = await prisma.announcement.create({
    data: {
      authorId: actor.actorId ?? null,
      title: input.title.trim(),
      body: input.body.trim(),
      category: input.category ?? "GENERAL",
      priority: input.priority ?? "NORMAL",
      course: input.course || null,
      year: input.year || null,
      org,
      pinned: input.pinned ?? false,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
    include: { author: { select: AUTHOR_SELECT.select } },
  });

  // The hop that puts it on every open board without a refresh.
  emitRealtime("announcement:created", toRealtime(announcement));

  await recordAuditLog({
    actorId: actor.actorId,
    action: "CREATE",
    entity: "SYSTEM",
    entityId: announcement.id,
    message: `Posted announcement "${announcement.title}"`,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    metadata: { category: announcement.category, priority: announcement.priority },
  });

  return announcement;
}

export async function updateAnnouncement(
  id: string,
  changes: {
    title?: string;
    body?: string;
    category?: string;
    priority?: string;
    course?: string;
    year?: string;
    pinned?: boolean;
    expiresAt?: string | null;
  },
  actor: ActorContext & { role?: string | null },
) {
  const existing = await prisma.announcement.findFirst({ where: { id, deletedAt: null } });

  if (!existing) {
    throw new UserServiceError("That announcement no longer exists.", 404);
  }

  // Authors may edit their own; moderators may edit anyone's.
  const isAuthor = Boolean(actor.actorId && existing.authorId === actor.actorId);
  if (!isAuthor && !canModerateAnnouncements(actor.role)) {
    throw new UserServiceError("You can only edit your own announcements.", 403);
  }

  if (changes.pinned !== undefined && !canModerateAnnouncements(actor.role)) {
    throw new UserServiceError("Only administrators can pin announcements.", 403);
  }

  const data: Record<string, unknown> = {};
  if (changes.title !== undefined) data.title = changes.title.trim();
  if (changes.body !== undefined) data.body = changes.body.trim();
  if (changes.category !== undefined) data.category = changes.category;
  if (changes.priority !== undefined) data.priority = changes.priority;
  if (changes.course !== undefined) data.course = changes.course || null;
  if (changes.year !== undefined) data.year = changes.year || null;
  if (changes.pinned !== undefined) data.pinned = changes.pinned;
  if (changes.expiresAt !== undefined) {
    data.expiresAt = changes.expiresAt ? new Date(changes.expiresAt) : null;
  }

  const announcement = await prisma.announcement.update({
    where: { id },
    data,
    include: { author: { select: AUTHOR_SELECT.select } },
  });

  emitRealtime("announcement:updated", toRealtime(announcement));

  await recordAuditLog({
    actorId: actor.actorId,
    action: "UPDATE",
    entity: "SYSTEM",
    entityId: id,
    message: `Updated announcement "${announcement.title}"`,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    metadata: { changedFields: Object.keys(data) },
  });

  return announcement;
}

export async function deleteAnnouncement(
  id: string,
  actor: ActorContext & { role?: string | null },
) {
  const existing = await prisma.announcement.findFirst({ where: { id, deletedAt: null } });

  if (!existing) {
    throw new UserServiceError("That announcement no longer exists.", 404);
  }

  const isAuthor = Boolean(actor.actorId && existing.authorId === actor.actorId);
  if (!isAuthor && !canModerateAnnouncements(actor.role)) {
    throw new UserServiceError("You can only delete your own announcements.", 403);
  }

  // Soft delete — the audit trail should still make sense afterwards.
  await prisma.announcement.update({ where: { id }, data: { deletedAt: new Date() } });

  emitRealtime("announcement:deleted", { id, title: existing.title });

  await recordAuditLog({
    actorId: actor.actorId,
    action: "DELETE",
    entity: "SYSTEM",
    entityId: id,
    message: `Deleted announcement "${existing.title}"`,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return { id };
}

// ---------------------------------------------------------------------------
// Read receipts
// ---------------------------------------------------------------------------

/**
 * Mark one announcement read by one user.
 *
 * `upsert` on the composite unique key makes this idempotent — a double click
 * cannot inflate `readCount`, because the counter is only incremented when the
 * receipt is genuinely new.
 */
export async function markAnnouncementRead(announcementId: string, userId: string) {
  const existing = await prisma.announcementRead.findUnique({
    where: { announcementId_userId: { announcementId, userId } },
  });

  if (existing) return { alreadyRead: true };

  await prisma.$transaction([
    prisma.announcementRead.create({ data: { announcementId, userId } }),
    prisma.announcement.update({
      where: { id: announcementId },
      data: { readCount: { increment: 1 } },
    }),
  ]);

  return { alreadyRead: false };
}

/** Unread count for the bell badge. */
export async function getUnreadAnnouncementCount(userId: string) {
  const now = new Date();

  return prisma.announcement.count({
    where: {
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      reads: { none: { userId } },
    },
  });
}
