/**
 * Student Voice — anonymous concerns with administrator review.
 *
 * THE WHOLE POINT OF THIS FILE
 * ----------------------------
 * A concern has two audiences that must see two different things:
 *
 *   students        the concern, and never who raised it
 *   administrators  the concern, and who raised it
 *
 * Those are built by two separate functions — `toPublicConcern` and
 * `toAdminConcern` — rather than by one function with a flag, and the public
 * one has no access to the author fields at all. A boolean that is wrong once
 * de-anonymises a student to their whole class; two functions cannot be wrong
 * in that direction, because the identity is simply not in scope.
 *
 * The same split governs the realtime events. `concern:created` names the
 * author and goes to the admin room only. `concern:updated` carries an id and
 * a status and nothing else, so it is safe to broadcast to everybody — clients
 * refetch through this module, which applies the rules again.
 *
 * WHY IDENTITY IS RECORDED AT ALL
 * -------------------------------
 * Because a complaint nobody can follow up on is not worth collecting. "The
 * third-floor lab has no power" needs a person to ask which bench. The promise
 * made to the student is that it is anonymous *to the college*, not that it is
 * unattributable — and that is the promise the UI states.
 */

import { prisma } from "@/lib/prisma";
import { UserServiceError, type ActorContext } from "@/lib/users";
import { recordAuditLog } from "@/lib/audit";
import { emitRealtime } from "@/lib/realtime";
import { ADMIN_ROLES, hasRole } from "@/lib/rbac";

export const CONCERN_STATUSES = ["PENDING", "APPROVED", "ADDRESSED"] as const;
export type ConcernStatus = (typeof CONCERN_STATUSES)[number];

export const CONCERN_CATEGORIES = [
  "Academic Concern",
  "Library Materials",
  "Facilities",
  "Student Support",
  "General Suggestion",
] as const;

/**
 * Categories that never reach the public board, whatever their status.
 *
 * An academic concern is about a grade, a lecturer, a subject, a failing — it
 * is the one category where publishing the text is enough to identify the
 * student to their own class even with the name stripped off. "Our 2nd-year
 * Statics lecturer has not returned the midterms" narrows to one section.
 *
 * So these are answered privately instead, by email, and `listConcerns`
 * excludes them from every non-moderator query — not by status, which an
 * administrator could set wrongly, but by category, which the student chose.
 */
export const PRIVATE_CONCERN_CATEGORIES: readonly string[] = ["Academic Concern"];

export function isPrivateCategory(category: string) {
  return PRIVATE_CONCERN_CATEGORIES.includes(category);
}

/**
 * Who may read identities, approve, respond and reject.
 *
 * Administrators, and the COE Student Council. Not faculty, and this is the
 * point rather than an oversight: a concern is frequently about a lecturer, so
 * the teaching staff are the one group that must not be able to see who raised
 * it. `ACADEMIC_STAFF_ROLES` would have included them.
 *
 * The council is here because it is the body students elect to carry their
 * concerns, and because the consent text on the form promises exactly this set
 * and no wider — if this function grows, that text has to grow with it.
 */
export function canModerateConcerns(role: string | null | undefined) {
  return hasRole(role, ADMIN_ROLES) || role === "ORG_OFFICER_COESC";
}

/**
 * Who may see the name attached to a concern.
 *
 * The same set, deliberately given its own name: "may act on this" and "may
 * see who wrote it" are different questions, and keeping them as two functions
 * means the day they stop being the same set, nothing silently follows along.
 */
export function canSeeConcernIdentity(role: string | null | undefined) {
  return canModerateConcerns(role);
}

/** Approved and addressed concerns are the board; pending ones are not. */
const PUBLIC_STATUSES: ConcernStatus[] = ["APPROVED", "ADDRESSED"];

type ConcernRow = {
  id: string;
  category: string;
  title: string;
  description: string;
  status: string;
  response: string | null;
  createdAt: Date;
  approvedAt: Date | null;
  addressedAt: Date | null;
  consentAt?: Date | null;
  contactEmail?: string | null;
  authorId?: string | null;
  author?: { id: string; name: string | null; username: string | null; email: string | null; role: string } | null;
  reviewedBy?: { name: string | null; username: string | null } | null;
};

/**
 * What a student receives.
 *
 * Note what is not here: no `authorId`, no `author`, no email. This object is
 * the reason the board can be called anonymous — the identity never leaves the
 * server, so there is nothing for a browser devtools panel to reveal.
 */
function toPublicConcern(row: ConcernRow) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    status: row.status,
    response: row.response ?? "",
    createdAt: row.createdAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? "",
    addressedAt: row.addressedAt?.toISOString() ?? "",
    /** True when this category is answered privately and never published. */
    isPrivate: isPrivateCategory(row.category),
    anonymous: true as const,
  };
}

/**
 * What a moderator receives — the same, plus who raised it and how to reply.
 *
 * `contactEmail` is here and not in the public shape for the same reason the
 * name is not: it identifies the student. It exists so an academic concern can
 * be answered at all, and it goes to the two bodies allowed to answer one.
 */
function toAdminConcern(row: ConcernRow) {
  return {
    ...toPublicConcern(row),
    anonymous: false as const,
    authorId: row.authorId ?? row.author?.id ?? null,
    authorName: row.author?.name ?? row.author?.username ?? "Deleted account",
    authorUsername: row.author?.username ?? "",
    authorEmail: row.author?.email ?? "",
    authorRole: row.author?.role ?? "",
    contactEmail: row.contactEmail ?? "",
    // Whether the student agreed to be named, and when. A row created before
    // consent was asked for has no timestamp, and says so rather than
    // pretending.
    consentAt: row.consentAt?.toISOString() ?? "",
    reviewedByName: row.reviewedBy?.name ?? row.reviewedBy?.username ?? "",
  };
}

const AUTHOR_INCLUDE = {
  author: { select: { id: true, name: true, username: true, email: true, role: true } },
  reviewedBy: { select: { name: true, username: true } },
} as const;

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * The board, as this viewer is allowed to see it.
 *
 * A non-moderator cannot widen this by asking: `status` is intersected with the
 * public set rather than trusted, so `?status=PENDING` from a student returns
 * the approved list, not the queue.
 */
export async function listConcerns(
  viewer: { id: string; role: string | null },
  query: { status?: string; category?: string } = {},
) {
  const moderator = canModerateConcerns(viewer.role);

  const requested = query.status && (CONCERN_STATUSES as readonly string[]).includes(query.status)
    ? (query.status as ConcernStatus)
    : null;

  const statusFilter = moderator
    ? requested
      ? { status: requested }
      : {}
    : { status: requested && PUBLIC_STATUSES.includes(requested) ? requested : { in: PUBLIC_STATUSES } };

  /*
   * The category condition, built once.
   *
   * Two rules meet on this one column and both have to survive:
   *
   *   * the filter the viewer picked ("show me Facilities");
   *   * and, for anyone who is not a moderator, the hard exclusion of the
   *     private categories.
   *
   * Written as two spreads of `{ category: … }` the second silently replaces
   * the first, and a student filtering the board by category would have got
   * the exclusion dropped — which is the one of the two that matters.
   *
   * A student asking for a private category by name gets nothing back, which
   * is correct: `notIn` and `equals` cannot both hold.
   */
  const categoryFilter = moderator
    ? query.category
      ? { category: query.category }
      : {}
    : {
        category: {
          ...(query.category ? { equals: query.category } : {}),
          notIn: [...PRIVATE_CONCERN_CATEGORIES],
        },
      };

  const rows = await prisma.concern.findMany({
    where: {
      deletedAt: null,
      ...statusFilter,
      ...categoryFilter,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    include: moderator ? AUTHOR_INCLUDE : undefined,
  });

  /*
   * The counters.
   *
   * Everyone gets the pending *count* — the board's "N waiting for review" tile
   * is how a student knows their submission is in a queue rather than lost. A
   * count reveals nothing about who wrote what.
   *
   * They are scoped the same way the list is, though. A student's totals that
   * included the private categories would say "12 on the board" above a list of
   * nine, and the missing three would be exactly the academic concerns the
   * board is not supposed to admit to holding.
   */
  const countScope = moderator
    ? { deletedAt: null }
    : { deletedAt: null, category: { notIn: [...PRIVATE_CONCERN_CATEGORIES] } };

  const [pending, approved, addressed] = await Promise.all([
    prisma.concern.count({ where: { ...countScope, status: "PENDING" } }),
    prisma.concern.count({ where: { ...countScope, status: "APPROVED" } }),
    prisma.concern.count({ where: { ...countScope, status: "ADDRESSED" } }),
  ]);

  /*
   * Branched, not `rows.map(moderator ? toAdminConcern : toPublicConcern)`.
   *
   * That one-liner does not type-check — the two mappers return different
   * shapes — and the obvious way to silence it is a cast, which would be
   * exactly the wrong fix here: a cast on this line is a cast on the boundary
   * between "students see this" and "administrators see this". Two branches
   * keep the compiler checking both shapes independently.
   */
  const concerns = moderator ? rows.map(toAdminConcern) : rows.map(toPublicConcern);

  return {
    concerns,
    totals: { pending, approved, addressed, all: pending + approved + addressed },
    canModerate: moderator,
  };
}

/** One concern, for the reviewer's detail dialog. Moderators only. */
export async function getConcernForModerator(id: string, role: string | null) {
  if (!canModerateConcerns(role)) {
    throw new UserServiceError("You do not have permission to review concerns.", 403);
  }

  const row = await prisma.concern.findFirst({
    where: { id, deletedAt: null },
    include: AUTHOR_INCLUDE,
  });

  if (!row) throw new UserServiceError("That concern no longer exists.", 404);

  return toAdminConcern(row);
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export async function createConcern(
  input: {
    category: string;
    title: string;
    description: string;
    consent: boolean;
    contactEmail?: string;
  },
  actor: ActorContext & { role?: string | null },
) {
  if (!(CONCERN_CATEGORIES as readonly string[]).includes(input.category)) {
    throw new UserServiceError("Choose one of the listed categories.", 400, "category");
  }

  /*
   * Consent is a precondition, not a preference.
   *
   * The row records who raised the concern, and the student is told so before
   * they send it. Checking here rather than only in the browser is the point:
   * the tick box is the interface to the promise, this line is the promise.
   */
  if (!input.consent) {
    throw new UserServiceError(
      "Tick the box to confirm you understand who can see your name.",
      400,
      "consent",
    );
  }

  const contactEmail = input.contactEmail?.trim() ?? "";

  /*
   * An academic concern is answered privately, so it needs somewhere to be
   * answered *to*. Without this it is a message the college can read and
   * cannot reply to — and the student would never learn that.
   */
  if (isPrivateCategory(input.category) && !contactEmail) {
    throw new UserServiceError(
      "An academic concern is answered privately, so an email address is required.",
      400,
      "contactEmail",
    );
  }

  const row = await prisma.concern.create({
    data: {
      authorId: actor.actorId ?? null,
      category: input.category,
      title: input.title.trim(),
      description: input.description.trim(),
      consentAt: new Date(),
      contactEmail: contactEmail || null,
    },
    include: AUTHOR_INCLUDE,
  });

  /*
   * Admin room only — this payload names the student.
   *
   * It is what makes a new submission appear in every administrator's queue
   * without a refresh, which is the reason the queue is worth watching.
   */
  emitRealtime("concern:created", {
    id: row.id,
    category: row.category,
    title: row.title,
    status: row.status,
    authorName: row.author?.name ?? row.author?.username ?? "Deleted account",
    createdAt: row.createdAt.toISOString(),
  });

  /*
   * Deliberately NOT audit-logged with the author.
   *
   * `recordAuditLog` stores `actorId`, and the audit log is readable in the
   * admin panel by anyone who can open it. Writing "X submitted concern Y"
   * there would put the link between student and complaint somewhere the
   * careful handling in this file does not reach. The row itself already
   * records the author for the people who need it.
   */

  return toPublicConcern(row);
}

export async function reviewConcern(
  id: string,
  changes: { status?: ConcernStatus; response?: string },
  actor: ActorContext & { role?: string | null },
) {
  if (!canModerateConcerns(actor.role)) {
    throw new UserServiceError("You do not have permission to review concerns.", 403);
  }

  const existing = await prisma.concern.findFirst({ where: { id, deletedAt: null } });

  if (!existing) throw new UserServiceError("That concern no longer exists.", 404);

  const status = changes.status ?? (existing.status as ConcernStatus);

  /*
   * APPROVED means "publish to the board", and a private category has no board
   * to be published to.
   *
   * Refused outright rather than accepted-and-ignored. `listConcerns` already
   * makes the status irrelevant for these — the exclusion is on category — so
   * allowing it would set a flag that does nothing, and leave the moderator
   * believing they had published something they had not. The useful states for
   * an academic concern are PENDING and ADDRESSED.
   */
  if (status === "APPROVED" && isPrivateCategory(existing.category)) {
    // "An Academic Concern", not "A Academic Concern" — the category name is
    // interpolated, so the article has to follow it.
    const article = /^[aeiou]/i.test(existing.category) ? "An" : "A";

    throw new UserServiceError(
      `${article} ${existing.category} is never published to the board. ` +
        `Reply to the student by email, then mark it Addressed.`,
      409,
      "status",
    );
  }

  const row = await prisma.concern.update({
    where: { id },
    data: {
      status,
      ...(changes.response !== undefined ? { response: changes.response.trim() || null } : {}),
      reviewedById: actor.actorId ?? null,
      // Stamped once. A concern re-approved after being addressed keeps the
      // date it first went public, which is what the board's ordering means.
      ...(status === "APPROVED" && !existing.approvedAt ? { approvedAt: new Date() } : {}),
      ...(status === "ADDRESSED" && !existing.addressedAt ? { addressedAt: new Date() } : {}),
    },
    include: AUTHOR_INCLUDE,
  });

  // Everyone, and safe to send everywhere: an id and a status, no identity.
  emitRealtime("concern:updated", { id: row.id, status: row.status });

  await recordAuditLog({
    actorId: actor.actorId,
    action: "UPDATE",
    entity: "SYSTEM",
    entityId: id,
    // The title, not the author — see the note in createConcern.
    message: `Set student concern "${row.title}" to ${row.status}`,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return toAdminConcern(row);
}

export async function deleteConcern(
  id: string,
  actor: ActorContext & { role?: string | null },
) {
  if (!canModerateConcerns(actor.role)) {
    throw new UserServiceError("You do not have permission to reject concerns.", 403);
  }

  const existing = await prisma.concern.findFirst({ where: { id, deletedAt: null } });

  if (!existing) throw new UserServiceError("That concern no longer exists.", 404);

  await prisma.concern.update({ where: { id }, data: { deletedAt: new Date() } });

  emitRealtime("concern:deleted", { id });

  await recordAuditLog({
    actorId: actor.actorId,
    action: "DELETE",
    entity: "SYSTEM",
    entityId: id,
    message: `Rejected student concern "${existing.title}"`,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return { id };
}
