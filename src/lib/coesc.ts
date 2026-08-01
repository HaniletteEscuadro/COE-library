/**
 * COESC — College of Engineering Student Council.
 *
 * Three things live here, and they share a file because they share one screen:
 *
 *   1. **The council roster.** Ten seats, seeded once, edited by administrators.
 *      Rows rather than markup, because the names change every academic year and
 *      a council written into the HTML can only be corrected by a redeploy.
 *
 *   2. **Committee applications.** The portal previously had an "interest form"
 *      that wrote to `localStorage` — so an application was visible only inside
 *      the browser that submitted it and reached nobody at all. These are real
 *      rows in the shared database, which is what makes "dapat makita namin ang
 *      mga pag-apply nila" true.
 *
 *   3. **The approvals queue.** A single count and list across the three things
 *      that need a decision — questions, uploaded materials, and applications —
 *      so a reviewer has one place to look instead of three.
 *
 * WHO MAY DO WHAT
 * ---------------
 * Reading is open to every signed-in account: the council, its announcements and
 * the committee list are public information inside the college, and the tab is
 * meant to be seen by everyone.
 *
 * Writing splits in two:
 *   * editing the roster and uploading photos — ADMIN only, as asked;
 *   * approving and rejecting — ADMIN or REGISTRAR, matching `ADMIN_ROLES`,
 *     which is the set already allowed to open the admin dashboard.
 *
 * Every check lives in this file rather than in the route handlers, so a new
 * route cannot forget one.
 */

import { prisma } from "@/lib/prisma";
import { UserServiceError } from "@/lib/users";
import { createNotification } from "@/lib/library";
import { emitRealtime } from "@/lib/realtime";
import { ADMIN_ROLES, SUPER_ADMIN_ROLES, hasRole } from "@/lib/rbac";
import { saveFile, removeFile } from "@/lib/storage";
import { validateUpload } from "@/lib/upload";

// ---------------------------------------------------------------------------
// The council
// ---------------------------------------------------------------------------

/**
 * The seats, in display order.
 *
 * `position` is a stable key and is what the database stores. The label and the
 * default name are seed data: an administrator renaming the holder of a seat
 * changes `name`, never `position`, so an uploaded photo stays attached to the
 * seat across an election.
 */
export const COUNCIL_SEATS = [
  { position: "ADVISER", label: "COESC Adviser", name: "Kenneth Castillo", course: "", tier: 0 },
  { position: "GOVERNOR", label: "Governor", name: "Matt A. Panahon", course: "", tier: 1 },
  { position: "VICE_GOVERNOR", label: "Vice Governor", name: "Rhomelee Pastrana", course: "", tier: 2 },
  { position: "SECRETARY", label: "Secretary", name: "Cia Gatmaitan", course: "", tier: 3 },
  { position: "ASSISTANT_SECRETARY", label: "Assistant Secretary", name: "Jellene R. Darullo", course: "", tier: 3 },
  { position: "TREASURER", label: "Treasurer", name: "Tareqa Apuan", course: "", tier: 3 },
  { position: "AUDITOR", label: "Auditor", name: "Blessie M. Ramos", course: "", tier: 3 },
  { position: "SOCIAL_MEDIA_SPECIALIST", label: "Social Media Specialist", name: "Zalilah R. Umali", course: "", tier: 3 },
  { position: "CE_REPRESENTATIVE", label: "CE Representative", name: "John Conrad", course: "CE", tier: 4 },
  { position: "EE_REPRESENTATIVE", label: "EE Representative", name: "Emmanuel A. Gepullano", course: "EE", tier: 4 },
] as const;

/**
 * The levels of the org chart, top to bottom.
 *
 * Kept here rather than in the front-end so the hierarchy is one fact in one
 * place: the tab draws whatever tiers the server describes, and adding a seat
 * later means editing this file only.
 *
 * The adviser is tier 0 and drawn with a dashed connector on purpose — a
 * faculty adviser advises the council, they are not above the Governor in the
 * student chain of command, and a solid line would say the opposite.
 */
export const COUNCIL_TIERS = [
  { tier: 0, label: "Faculty Adviser", link: "dashed" },
  { tier: 1, label: "Executive", link: "none" },
  { tier: 2, label: "Executive", link: "solid" },
  { tier: 3, label: "Council Officers", link: "solid" },
  { tier: 4, label: "Course Representatives", link: "solid" },
] as const;

/** Seat key -> tier, for rows that predate the tier field. */
const TIER_BY_POSITION = new Map<string, number>(
  COUNCIL_SEATS.map((seat) => [seat.position, seat.tier]),
);

/**
 * Seat key -> canonical position in the chart.
 *
 * `sortOrder` is written into the row when the roster is first seeded, and then
 * never again — so reordering `COUNCIL_SEATS` afterwards changed nothing for a
 * database that had already been seeded, and the chart kept the old order.
 * Ordering by this map instead means the array above is the single source of
 * truth for the layout, and changing it takes effect everywhere with no
 * migration and no data fix.
 *
 * The stored `sortOrder` is the fallback, for a seat added directly to the
 * database that this list does not know about.
 */
const ORDER_BY_POSITION = new Map<string, number>(
  COUNCIL_SEATS.map((seat, index) => [seat.position, index]),
);

function canonicalOrder(officer: { position: string; sortOrder: number }) {
  return ORDER_BY_POSITION.get(officer.position) ?? 1000 + officer.sortOrder;
}

/** Committees a student may apply to. */
export const COMMITTEES = [
  {
    slug: "academics",
    name: "Academics & Research",
    description: "Review sessions, study materials, and academic support drives.",
  },
  {
    slug: "events",
    name: "Events & Programs",
    description: "Planning and running COESC activities, seminars and competitions.",
  },
  {
    slug: "media",
    name: "Media & Publicity",
    description: "Posters, social media, photo and video coverage of council events.",
  },
  {
    slug: "finance",
    name: "Finance & Logistics",
    description: "Budget tracking, fundraising, materials and venue coordination.",
  },
  {
    slug: "outreach",
    name: "Community Outreach",
    description: "Service projects and partnerships beyond the college.",
  },
  {
    slug: "sports",
    name: "Sports & Wellness",
    description: "Intramurals, training and student wellbeing initiatives.",
  },
] as const;

export const APPLICATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Portraits are small and shown inline; a 5 MB cap is generous for a photo. */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export type Actor = { id: string; name: string | null; role: string };

/** Editing the roster and uploading photos. ADMIN only, as specified. */
export function canManageCouncil(role: string | null | undefined) {
  return hasRole(role, SUPER_ADMIN_ROLES);
}

/** Approving questions, materials and applications. ADMIN or REGISTRAR. */
export function canReview(role: string | null | undefined) {
  return hasRole(role, ADMIN_ROLES);
}

function assertCanManage(actor: Actor) {
  if (!canManageCouncil(actor.role)) {
    throw new UserServiceError("Only an administrator can change the council roster.", 403);
  }
}

function assertCanReview(actor: Actor) {
  if (!canReview(actor.role)) {
    throw new UserServiceError("You do not have permission to review submissions.", 403);
  }
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

type OfficerRow = {
  id: string;
  position: string;
  positionLabel: string;
  name: string;
  course: string | null;
  photoKey: string | null;
  photoUpdatedAt: Date | null;
  sortOrder: number;
};

/**
 * Wire shape.
 *
 * `photoKey` never leaves the server — it is the on-disk location, and the same
 * rule the library follows applies here. Clients get a boolean and a versioned
 * URL instead; the version is what makes a replaced photo actually appear
 * rather than being served from the browser cache for another hour.
 */
function toWireOfficer(officer: OfficerRow) {
  return {
    id: officer.id,
    position: officer.position,
    positionLabel: officer.positionLabel,
    name: officer.name,
    course: officer.course || "",
    hasPhoto: Boolean(officer.photoKey),
    photoUrl: officer.photoKey
      ? `/api/coesc/officers/${officer.id}/photo?v=${officer.photoUpdatedAt?.getTime() ?? 0}`
      : null,
    // The canonical order, not the stored one — see ORDER_BY_POSITION.
    sortOrder: canonicalOrder(officer),
    // Which level of the org chart this seat sits on. Derived rather than
    // stored, so the hierarchy can be reshaped without a migration.
    tier: TIER_BY_POSITION.get(officer.position) ?? 3,
  };
}

export type WireOfficer = ReturnType<typeof toWireOfficer>;

const OFFICER_SELECT = {
  id: true,
  position: true,
  positionLabel: true,
  name: true,
  course: true,
  photoKey: true,
  photoUpdatedAt: true,
  sortOrder: true,
} as const;

/**
 * The roster, creating it on first read if the table is empty.
 *
 * Self-seeding rather than relying on `prisma/seed.ts`: an existing deployment
 * upgrading to this feature runs `migrate deploy`, not the seed, and would
 * otherwise show an empty council with no indication why.
 */
export async function listOfficers(): Promise<WireOfficer[]> {
  const existing = await prisma.councilOfficer.findMany({ select: OFFICER_SELECT });

  if (existing.length > 0) {
    return existing.map(toWireOfficer).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /*
   * Two page loads arriving together would both find the table empty and both
   * try to seed it, and the second would fail on the unique `position` — which
   * would surface as an empty council for whoever lost the race.
   *
   * `skipDuplicates` is the usual answer but the SQLite connector does not
   * support it, so the insert is simply allowed to fail: whatever the winner
   * wrote is what the re-read below returns, which is the same result either
   * way.
   */
  try {
    await prisma.councilOfficer.createMany({
      data: COUNCIL_SEATS.map((seat, index) => ({
        position: seat.position,
        positionLabel: seat.label,
        name: seat.name,
        course: seat.course || null,
        sortOrder: index,
      })),
    });
  } catch (error) {
    console.warn("[coesc] roster seed raced with another request", error);
  }

  const seeded = await prisma.councilOfficer.findMany({ select: OFFICER_SELECT });

  return seeded.map(toWireOfficer).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Rename the holder of a seat, or change its course accent. ADMIN only. */
export async function updateOfficer(
  id: string,
  input: { name?: string; course?: string | null },
  actor: Actor,
) {
  assertCanManage(actor);

  const officer = await prisma.councilOfficer.findUnique({ where: { id } });
  if (!officer) throw new UserServiceError("That council seat no longer exists.", 404);

  const name = input.name?.trim();
  if (name !== undefined && name.length < 2) {
    throw new UserServiceError("Enter the officer's full name.", 400, "name");
  }

  const updated = await prisma.councilOfficer.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(input.course !== undefined ? { course: input.course?.trim().toUpperCase() || null } : {}),
      updatedById: actor.id,
    },
    select: OFFICER_SELECT,
  });

  const wire = toWireOfficer(updated);
  emitRealtime("coesc:officer-updated", wire);

  return wire;
}

/**
 * Replace a seat's portrait. ADMIN only.
 *
 * The bytes are validated the same way a library upload is — the declared MIME
 * type is a hint, and `validateUpload` reads the magic bytes — because an image
 * that is really an HTML file would otherwise be served from this origin and
 * run with everyone's session cookie. The type list is narrowed to real photo
 * formats on top of that; SVG is excluded for the same reason it is excluded
 * from the library.
 */
export async function replaceOfficerPhoto(
  id: string,
  file: { filename: string; mimeType: string | null; buffer: Buffer },
  actor: Actor,
) {
  assertCanManage(actor);

  const officer = await prisma.councilOfficer.findUnique({ where: { id } });
  if (!officer) throw new UserServiceError("That council seat no longer exists.", 404);

  if (file.buffer.length === 0) {
    throw new UserServiceError("That file is empty.", 400);
  }

  if (file.buffer.length > MAX_PHOTO_BYTES) {
    throw new UserServiceError("Photos must be 5 MB or smaller.", 400);
  }

  // Throws UploadValidationError for a mismatch between name, type and bytes.
  let validated;
  try {
    validated = validateUpload({
      filename: file.filename,
      declaredMimeType: file.mimeType,
      buffer: file.buffer,
    });
  } catch (error) {
    throw new UserServiceError(
      error instanceof Error ? error.message : "That file could not be read as an image.",
      400,
    );
  }

  if (!PHOTO_TYPES.includes(validated.mimeType)) {
    throw new UserServiceError("Upload a JPG, PNG or WebP image.", 400);
  }

  const stored = await saveFile(`coesc/${id}/${validated.storageKey}`, file.buffer);

  // Only after the new file is safely on disk, so a failed write never leaves
  // the seat with no photo at all.
  const previousKey = officer.photoKey;

  const updated = await prisma.councilOfficer.update({
    where: { id },
    data: {
      photoKey: stored.key,
      photoMimeType: validated.mimeType,
      photoSize: stored.sizeBytes,
      photoUpdatedAt: new Date(),
      updatedById: actor.id,
    },
    select: OFFICER_SELECT,
  });

  if (previousKey && previousKey !== stored.key) {
    // Best effort: an orphaned file wastes a little disk, a failed request
    // wastes the administrator's time.
    await removeFile(previousKey).catch(() => {});
  }

  const wire = toWireOfficer(updated);
  emitRealtime("coesc:officer-updated", wire);

  return wire;
}

/** Storage key and type for the photo route. Not exposed to clients. */
export async function getOfficerPhoto(id: string) {
  const officer = await prisma.councilOfficer.findUnique({
    where: { id },
    select: { photoKey: true, photoMimeType: true, photoSize: true },
  });

  if (!officer?.photoKey) return null;

  return {
    key: officer.photoKey,
    mimeType: officer.photoMimeType || "application/octet-stream",
    size: officer.photoSize,
  };
}

// ---------------------------------------------------------------------------
// Committee applications
// ---------------------------------------------------------------------------

const APPLICATION_SELECT = {
  id: true,
  committee: true,
  fullName: true,
  course: true,
  yearLevel: true,
  contact: true,
  message: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
  applicantId: true,
  applicant: { select: { name: true, username: true, email: true, image: true } },
  reviewedBy: { select: { name: true, username: true } },
} as const;

type ApplicationRow = {
  id: string;
  committee: string;
  fullName: string;
  course: string;
  yearLevel: string;
  contact: string | null;
  message: string;
  status: string;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  applicantId: string;
  applicant: { name: string | null; username: string | null; email: string | null; image: string | null } | null;
  reviewedBy: { name: string | null; username: string | null } | null;
};

/**
 * Wire shape for an application.
 *
 * `includeContact` is the privacy switch. A reviewer needs the applicant's email
 * and phone number to act on the application; the applicant themself already
 * knows it. Nobody else ever receives either — the list route decides which of
 * those two cases it is in, and this function cannot leak by omission.
 */
function toWireApplication(row: ApplicationRow, includeContact: boolean) {
  const committee = COMMITTEES.find((c) => c.slug === row.committee);

  return {
    id: row.id,
    committee: row.committee,
    committeeName: committee?.name ?? row.committee,
    fullName: row.fullName,
    course: row.course,
    yearLevel: row.yearLevel,
    message: row.message,
    status: row.status,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedByName: row.reviewedBy?.name ?? row.reviewedBy?.username ?? null,
    createdAt: row.createdAt.toISOString(),
    applicantId: row.applicantId,
    applicantImage: row.applicant?.image ?? null,
    ...(includeContact
      ? {
          contact: row.contact,
          applicantEmail: row.applicant?.email ?? null,
          applicantUsername: row.applicant?.username ?? null,
        }
      : {}),
  };
}

export async function createApplication(
  input: {
    committee: string;
    fullName: string;
    course: string;
    yearLevel: string;
    contact?: string | null;
    message: string;
  },
  actor: Actor,
) {
  const committee = COMMITTEES.find((c) => c.slug === input.committee);
  if (!committee) {
    throw new UserServiceError("Choose a committee from the list.", 400, "committee");
  }

  /*
   * One live application per committee.
   *
   * A plain unique index would have locked a student out of a committee for
   * ever after a single rejection, so the rule is enforced here on PENDING and
   * APPROVED only — a rejected application is kept for the record and does not
   * block a fresh attempt.
   */
  const active = await prisma.committeeApplication.findFirst({
    where: {
      applicantId: actor.id,
      committee: input.committee,
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: { status: true },
  });

  if (active) {
    throw new UserServiceError(
      active.status === "APPROVED"
        ? `You are already part of ${committee.name}.`
        : `You already have an application waiting for ${committee.name}.`,
      409,
    );
  }

  const created = await prisma.committeeApplication.create({
    data: {
      applicantId: actor.id,
      committee: input.committee,
      fullName: input.fullName.trim(),
      course: input.course.trim().toUpperCase(),
      yearLevel: input.yearLevel.trim(),
      contact: input.contact?.trim() || null,
      message: input.message.trim(),
    },
    select: APPLICATION_SELECT,
  });

  /*
   * Tell the reviewers.
   *
   * Broadcast to the staff room rather than the shared one: an application
   * names a student and says what they wrote, which is not for the whole
   * college to read.
   */
  emitRealtime("coesc:application-created", {
    id: created.id,
    committee: created.committee,
    committeeName: committee.name,
    fullName: created.fullName,
    course: created.course,
    yearLevel: created.yearLevel,
    status: created.status,
    createdAt: created.createdAt.toISOString(),
  });

  return toWireApplication(created, true);
}

/**
 * List applications.
 *
 * A reviewer sees every application. Everyone else sees only their own — the
 * `where` clause is built here, not passed in, so a route cannot widen it by
 * forwarding a query parameter.
 */
export async function listApplications(
  actor: Actor,
  filter: { status?: string; committee?: string } = {},
) {
  const reviewer = canReview(actor.role);

  const rows = await prisma.committeeApplication.findMany({
    where: {
      ...(reviewer ? {} : { applicantId: actor.id }),
      ...(filter.status && APPLICATION_STATUSES.includes(filter.status as ApplicationStatus)
        ? { status: filter.status }
        : {}),
      ...(filter.committee ? { committee: filter.committee } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: APPLICATION_SELECT,
  });

  return {
    canReview: reviewer,
    applications: rows.map((row) => toWireApplication(row, true)),
  };
}

/** Approve or reject. ADMIN or REGISTRAR. */
export async function reviewApplication(
  id: string,
  input: { status: ApplicationStatus; note?: string | null },
  actor: Actor,
) {
  assertCanReview(actor);

  if (!APPLICATION_STATUSES.includes(input.status) || input.status === "PENDING") {
    throw new UserServiceError("Choose approve or reject.", 400, "status");
  }

  const application = await prisma.committeeApplication.findUnique({ where: { id } });
  if (!application) throw new UserServiceError("That application no longer exists.", 404);

  const updated = await prisma.committeeApplication.update({
    where: { id },
    data: {
      status: input.status,
      reviewNote: input.note?.trim() || null,
      reviewedById: actor.id,
      reviewedAt: new Date(),
    },
    select: APPLICATION_SELECT,
  });

  const committee = COMMITTEES.find((c) => c.slug === updated.committee);
  const approved = input.status === "APPROVED";

  // The applicant is told either way. A decision nobody is told about is the
  // same as no decision.
  await createNotification({
    userId: updated.applicantId,
    type: "COESC_APPLICATION",
    title: approved
      ? `You're in — ${committee?.name ?? updated.committee}`
      : `Update on your ${committee?.name ?? updated.committee} application`,
    body: updated.reviewNote || (approved ? "The council approved your application." : "The council could not take your application this time."),
    href: "/portal/index.html#coesc",
    actorName: actor.name,
  });

  emitRealtime("coesc:application-updated", {
    id: updated.id,
    committee: updated.committee,
    status: updated.status,
    applicantId: updated.applicantId,
  });

  return toWireApplication(updated, true);
}

// ---------------------------------------------------------------------------
// The approvals queue
// ---------------------------------------------------------------------------

/**
 * Everything waiting on a decision, in one call.
 *
 * Three separate queues previously lived on three separate screens, which is
 * how a question sits unapproved for a week — nobody had a reason to open the
 * page it was on. One list with one count is the whole point.
 */
export async function listPendingApprovals(actor: Actor) {
  assertCanReview(actor);

  const [questions, materials, applications] = await Promise.all([
    prisma.question.findMany({
      where: { reviewStatus: "PENDING", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        description: true,
        course: true,
        yearLevel: true,
        subject: true,
        createdAt: true,
        asker: { select: { name: true, username: true } },
      },
    }),
    prisma.material.findMany({
      where: { status: "PENDING", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        originalName: true,
        kind: true,
        sizeBytes: true,
        createdAt: true,
        folder: { select: { path: true } },
        uploadedBy: { select: { name: true, username: true } },
      },
    }),
    prisma.committeeApplication.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: APPLICATION_SELECT,
    }),
  ]);

  return {
    counts: {
      questions: questions.length,
      materials: materials.length,
      applications: applications.length,
      total: questions.length + materials.length + applications.length,
    },
    questions: questions.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      course: q.course,
      yearLevel: q.yearLevel,
      subject: q.subject,
      askerName: q.asker?.name ?? q.asker?.username ?? "Unknown",
      createdAt: q.createdAt.toISOString(),
    })),
    materials: materials.map((m) => ({
      id: m.id,
      title: m.title,
      originalName: m.originalName,
      kind: m.kind,
      sizeBytes: m.sizeBytes,
      folderPath: m.folder?.path ?? "",
      uploadedByName: m.uploadedBy?.name ?? m.uploadedBy?.username ?? "Unknown",
      createdAt: m.createdAt.toISOString(),
    })),
    applications: applications.map((row) => toWireApplication(row, true)),
  };
}
