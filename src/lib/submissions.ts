/**
 * Assignments and submissions.
 *
 * The access rule that shapes this whole file:
 *
 *   Assignment  — every signed-in student sees it. That is the point.
 *   Submission  — only its author and academic staff may read it.
 *
 * A student must never be able to see another student's answer, score, or even
 * whether they have submitted. Every read path here enforces that server-side;
 * hiding it in the UI would not be access control.
 *
 * Nothing here imports `next/*`.
 */

import { prisma } from "@/lib/prisma";
import { emitRealtime } from "@/lib/realtime";
import { recordAuditLog } from "@/lib/audit";
import { UserServiceError, type ActorContext } from "@/lib/users";
import { ACADEMIC_STAFF_ROLES, hasRole } from "@/lib/rbac";

/** Faculty, registrars and admins. */
export function isAcademicStaff(role: string | null | undefined) {
  return hasRole(role, ACADEMIC_STAFF_ROLES);
}

const AUTHOR_SELECT = { id: true, name: true, username: true, role: true } as const;

function toRealtimeAssignment(row: {
  id: string;
  title: string;
  description: string | null;
  course: string | null;
  year: string | null;
  subject: string | null;
  status: string;
  dueAt: Date | null;
  points: number;
  submissionCount: number;
  authorId: string | null;
  createdAt: Date;
  author?: { name: string | null; username: string | null } | null;
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    course: row.course,
    year: row.year,
    subject: row.subject,
    status: row.status,
    dueAt: row.dueAt?.toISOString() ?? null,
    points: row.points,
    submissionCount: row.submissionCount,
    authorId: row.authorId,
    authorName: row.author?.name ?? row.author?.username ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Assignments — shared
// ---------------------------------------------------------------------------

/**
 * List assignments.
 *
 * Every student gets the same rows. `viewerId` only decides whether each row
 * carries *that* student's own submission summary — it never filters the set.
 */
export async function listAssignments(
  query: {
    search?: string;
    course?: string;
    year?: string;
    subject?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  },
  viewer: { id: string; role: string },
) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const staff = isAcademicStaff(viewer.role);

  const where = {
    deletedAt: null,
    // Drafts belong to their author until opened.
    ...(staff ? {} : { status: { not: "DRAFT" } }),
    ...(query.status ? { status: query.status } : {}),
    ...(query.course ? { course: query.course } : {}),
    ...(query.year ? { year: query.year } : {}),
    ...(query.subject ? { subject: query.subject } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search } },
            { description: { contains: query.search } },
            { subject: { contains: query.search } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.assignment.findMany({
      where,
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        author: { select: AUTHOR_SELECT },
        // Only the viewer's own row. A student asking for this list can never
        // receive anyone else's submission.
        submissions: {
          where: { studentId: viewer.id, deletedAt: null },
          select: { id: true, status: true, isLate: true, score: true, submittedAt: true },
        },
      },
    }),
    prisma.assignment.count({ where }),
  ]);

  return {
    assignments: rows.map((row) => ({
      ...toRealtimeAssignment(row),
      gradedCount: staff ? row.gradedCount : undefined,
      mySubmission: row.submissions[0]
        ? {
            id: row.submissions[0].id,
            status: row.submissions[0].status,
            isLate: row.submissions[0].isLate,
            score: row.submissions[0].score,
            submittedAt: row.submissions[0].submittedAt.toISOString(),
          }
        : null,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    canCreate: staff,
  };
}

export async function createAssignment(
  input: {
    title: string;
    description?: string;
    instructions?: string;
    course?: string;
    year?: string;
    subject?: string;
    status?: string;
    dueAt?: string | null;
    points?: number;
    allowLate?: boolean;
    /// Expected answer for the portal's auto-check. Server-side only.
    answerKey?: string;
  },
  actor: ActorContext & { role?: string | null },
) {
  if (!isAcademicStaff(actor.role)) {
    throw new UserServiceError("Only faculty and administrators can post assignments.", 403);
  }

  const assignment = await prisma.assignment.create({
    data: {
      authorId: actor.actorId ?? null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      instructions: input.instructions?.trim() || null,
      course: input.course || null,
      year: input.year || null,
      subject: input.subject || null,
      status: input.status ?? "OPEN",
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      points: input.points ?? 100,
      allowLate: input.allowLate ?? true,
      answerKey: input.answerKey?.trim() || null,
    },
    include: { author: { select: AUTHOR_SELECT } },
  });

  // Only announce it once it is actually visible to students.
  if (assignment.status !== "DRAFT") {
    emitRealtime("assignment:created", toRealtimeAssignment(assignment));
  }

  await recordAuditLog({
    actorId: actor.actorId,
    action: "CREATE",
    entity: "SYSTEM",
    entityId: assignment.id,
    message: `Posted assignment "${assignment.title}"`,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return assignment;
}

/** Full detail, including instructions. Staff also get the submission list. */
export async function getAssignment(id: string, viewer: { id: string; role: string }) {
  const staff = isAcademicStaff(viewer.role);

  const assignment = await prisma.assignment.findFirst({
    where: { id, deletedAt: null, ...(staff ? {} : { status: { not: "DRAFT" } }) },
    include: {
      author: { select: AUTHOR_SELECT },
      submissions: staff
        ? {
            where: { deletedAt: null },
            orderBy: { submittedAt: "desc" },
            include: { student: { select: AUTHOR_SELECT } },
          }
        : // A student receives only their own.
          {
            where: { studentId: viewer.id, deletedAt: null },
          },
    },
  });

  if (!assignment) {
    throw new UserServiceError("That assignment is not available.", 404);
  }

  // `answerKey` is a scalar on the row, so it comes back from findFirst whether
  // or not anyone asked for it. Stripped here for students rather than at the
  // route, so a future route that returns this object cannot leak the key by
  // forgetting to.
  if (!staff) {
    const { answerKey: _answerKey, ...safe } = assignment;
    return safe;
  }

  return assignment;
}

// ---------------------------------------------------------------------------
// Submissions — private
// ---------------------------------------------------------------------------

/**
 * Create or replace a student's submission.
 *
 * `upsert` on `[assignmentId, studentId]` is what makes resubmitting update the
 * existing row instead of creating a second one, so a student can never appear
 * twice in the grading list.
 */
export async function submitWork(
  assignmentId: string,
  input: {
    content?: string;
    storageKey?: string | null;
    originalName?: string | null;
    mimeType?: string | null;
    sizeBytes?: number;
  },
  actor: ActorContext & { role?: string | null; actorName?: string | null },
) {
  if (!actor.actorId) {
    throw new UserServiceError("Sign in to submit.", 401);
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, deletedAt: null, status: { not: "DRAFT" } },
  });

  if (!assignment) {
    throw new UserServiceError("That assignment is not available.", 404);
  }

  if (assignment.status === "CLOSED") {
    throw new UserServiceError("This assignment is closed.", 409);
  }

  if (!input.content?.trim() && !input.storageKey) {
    throw new UserServiceError("Attach a file or write an answer.", 400, "content");
  }

  const now = new Date();
  const isLate = Boolean(assignment.dueAt && now > assignment.dueAt);

  if (isLate && !assignment.allowLate) {
    throw new UserServiceError("The deadline has passed and late work is not accepted.", 409);
  }

  const existing = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: actor.actorId } },
  });

  const submission = await prisma.submission.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId: actor.actorId } },
    create: {
      assignmentId,
      studentId: actor.actorId,
      content: input.content?.trim() || null,
      storageKey: input.storageKey ?? null,
      originalName: input.originalName ?? null,
      mimeType: input.mimeType ?? null,
      sizeBytes: input.sizeBytes ?? 0,
      status: "SUBMITTED",
      isLate,
      submittedAt: now,
    },
    update: {
      content: input.content?.trim() || null,
      storageKey: input.storageKey ?? null,
      originalName: input.originalName ?? null,
      mimeType: input.mimeType ?? null,
      sizeBytes: input.sizeBytes ?? 0,
      // Re-submitting after feedback is a distinct state from a first attempt.
      status: existing?.status === "RETURNED" ? "RESUBMITTED" : "SUBMITTED",
      isLate,
      submittedAt: now,
      deletedAt: null,
    },
    include: { student: { select: AUTHOR_SELECT } },
  });

  // Only a genuinely new submission moves the counter.
  if (!existing) {
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { submissionCount: { increment: 1 } },
    });
  }

  // --- Auto-check against the answer key ---------------------------------
  //
  // The COE portal used to compare the typed answer to the key in the browser,
  // which meant the key had to be in the browser. Doing it here keeps
  // `answerKey` server-side: a full-marks score is awarded on an exact match
  // after normalisation, and a wrong answer is left for a human to look at
  // rather than being scored zero automatically.
  if (assignment.answerKey && input.content?.trim()) {
    const normalise = (value: string) =>
      value.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:]+$/, "");

    if (normalise(input.content) === normalise(assignment.answerKey)) {
      const graded = await prisma.submission.update({
        where: { id: submission.id },
        data: { score: assignment.points, status: "RETURNED", gradedAt: now },
        include: { student: { select: AUTHOR_SELECT } },
      });

      Object.assign(submission, graded);
    }
  }

  // Staff room only — broadcasting this to everyone would tell the whole class
  // who has and has not submitted.
  emitRealtime("submission:created", {
    id: submission.id,
    assignmentId,
    assignmentTitle: assignment.title,
    studentId: submission.studentId,
    studentName: submission.student?.name ?? submission.student?.username ?? null,
    status: submission.status,
    isLate: submission.isLate,
    score: submission.score,
    submittedAt: submission.submittedAt.toISOString(),
  });

  return submission;
}

/**
 * Read one submission.
 *
 * The authorisation check is the reason this function exists rather than a
 * bare Prisma call at the route.
 */
export async function getSubmission(id: string, viewer: { id: string; role: string }) {
  const submission = await prisma.submission.findFirst({
    where: { id, deletedAt: null },
    include: {
      student: { select: AUTHOR_SELECT },
      assignment: { select: { id: true, title: true, points: true } },
    },
  });

  if (!submission) {
    throw new UserServiceError("That submission no longer exists.", 404);
  }

  const isOwner = submission.studentId === viewer.id;

  if (!isOwner && !isAcademicStaff(viewer.role)) {
    // 404 rather than 403: confirming it exists would itself leak that this
    // student submitted.
    throw new UserServiceError("That submission no longer exists.", 404);
  }

  return submission;
}

/** Grade and return work. Staff only. */
export async function gradeSubmission(
  id: string,
  input: { score?: number | null; feedback?: string; status?: string },
  actor: ActorContext & { role?: string | null },
) {
  if (!isAcademicStaff(actor.role)) {
    throw new UserServiceError("Only faculty and administrators can grade.", 403);
  }

  const existing = await prisma.submission.findFirst({
    where: { id, deletedAt: null },
    include: { assignment: { select: { id: true, title: true, points: true } } },
  });

  if (!existing) {
    throw new UserServiceError("That submission no longer exists.", 404);
  }

  if (input.score !== undefined && input.score !== null) {
    if (input.score < 0 || input.score > existing.assignment.points) {
      throw new UserServiceError(
        `Score must be between 0 and ${existing.assignment.points}.`,
        400,
        "score",
      );
    }
  }

  const wasGraded = existing.gradedAt !== null;

  const submission = await prisma.submission.update({
    where: { id },
    data: {
      score: input.score ?? existing.score,
      feedback: input.feedback?.trim() ?? existing.feedback,
      status: input.status ?? "RETURNED",
      gradedById: actor.actorId ?? null,
      gradedAt: new Date(),
    },
    include: { student: { select: AUTHOR_SELECT } },
  });

  if (!wasGraded) {
    await prisma.assignment.update({
      where: { id: existing.assignmentId },
      data: { gradedCount: { increment: 1 } },
    });
  }

  emitRealtime("submission:updated", {
    id: submission.id,
    assignmentId: submission.assignmentId,
    assignmentTitle: existing.assignment.title,
    studentId: submission.studentId,
    studentName: submission.student?.name ?? submission.student?.username ?? null,
    status: submission.status,
    isLate: submission.isLate,
    score: submission.score,
    submittedAt: submission.submittedAt.toISOString(),
  });

  // Tell the student their work came back.
  const { createNotification } = await import("@/lib/library");
  await createNotification({
    userId: submission.studentId,
    type: "SYSTEM",
    title: `"${existing.assignment.title}" was graded`,
    body:
      submission.score !== null
        ? `Score: ${submission.score} / ${existing.assignment.points}`
        : "Your work was reviewed.",
    href: `/assignments/${submission.assignmentId}`,
  });

  await recordAuditLog({
    actorId: actor.actorId,
    action: "UPDATE",
    entity: "GRADE",
    entityId: submission.id,
    message: `Graded submission for "${existing.assignment.title}"`,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    metadata: { score: submission.score },
  });

  return submission;
}

/** Everything a student has handed in. Their own only. */
export async function listMySubmissions(studentId: string) {
  return prisma.submission.findMany({
    where: { studentId, deletedAt: null },
    orderBy: { submittedAt: "desc" },
    include: { assignment: { select: { id: true, title: true, points: true, dueAt: true } } },
  });
}

