/**
 * Q&A hub service — "Tanong Mo, Sagot Ko".
 *
 * Every write here does two things: commit the row, then broadcast it. The
 * broadcast is what the whole feature is for — a question used to live in the
 * asker's own browser, so the "3 answers" on their card was a count of their
 * own storage and nobody else could see the question at all.
 *
 * Counters (`answerCount`, `voteCount`, `commentCount`, `flagCount`) are
 * denormalised onto the parent row and updated inside the same transaction as
 * the thing they count. Deriving them per render was the alternative, and it
 * means a `COUNT(*)` per answer per card on a board that only grows.
 */

import { prisma } from "@/lib/prisma";
import { UserServiceError } from "@/lib/users";
import { hasRole } from "@/lib/rbac";
import {
  emitRealtime,
  parseTags,
  type RealtimeAnswer,
  type RealtimeAnswerComment,
  type RealtimeQuestion,
} from "@/lib/realtime";
import { createNotification } from "@/lib/library";

/** Display strings, kept identical to the portal's QUESTION_STATUS. */
export const QUESTION_STATUSES = [
  "Unanswered",
  "Answered",
  "Verified Answer",
  "Solved",
] as const;

export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

/** Faculty and above may verify an answer or mark a question solved. */
const QA_MODERATOR_ROLES = ["ADMIN", "FACULTY", "REGISTRAR", "LIBRARIAN"] as const;

export function canVerifyAnswers(role: string | null | undefined) {
  return hasRole(role, QA_MODERATOR_ROLES);
}

/**
 * Who may post an answer without waiting for review.
 *
 * Staff. Their reply is the official one and goes straight onto the board.
 */
const QA_ANSWERER_ROLES = ["ADMIN", "FACULTY"] as const;

/**
 * Who may post an answer at all.
 *
 * Students too, now. The board used to be "students ask, staff reply", and a
 * classmate who knew the answer had nowhere to put it — which on a board whose
 * name is "Tanong Mo, Sagot Ko" was the odd half to have missing.
 *
 * The safeguard is not who may write, it is what happens next: an answer from
 * anyone outside QA_ANSWERER_ROLES is created PENDING and stays invisible to
 * the rest of the college until an administrator publishes it. So a student can
 * help, and nobody reads a wrong answer in the meantime.
 */
const QA_ANY_ANSWERER_ROLES = ["ADMIN", "FACULTY", "REGISTRAR", "LIBRARIAN", "STUDENT"] as const;

export function canAnswerQuestions(role: string | null | undefined) {
  return hasRole(role, QA_ANY_ANSWERER_ROLES);
}

/** True when this account's answers skip the review queue. */
export function canAnswerWithoutReview(role: string | null | undefined) {
  return hasRole(role, QA_ANSWERER_ROLES);
}

/** Who may publish or refuse a pending answer. Same set that may verify one. */
export function canReviewAnswers(role: string | null | undefined) {
  return hasRole(role, QA_MODERATOR_ROLES);
}

/**
 * Who may approve or reject a question, and whose own questions skip the queue.
 * Deliberately the same set that may answer: if you are trusted to give the
 * official reply, you are trusted to post without review.
 */
export function canReviewQuestions(role: string | null | undefined) {
  return hasRole(role, QA_ANSWERER_ROLES);
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

type QuestionRow = {
  id: string;
  title: string;
  description: string;
  course: string;
  yearLevel: string;
  subject: string;
  lesson: string;
  tags: string;
  status: string;
  reviewStatus: string;
  askerId: string | null;
  askerName: string;
  bestAnswerId: string | null;
  answerCount: number;
  viewCount: number;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentSize: number;
  createdAt: Date;
  updatedAt: Date;
};

export function toRealtimeQuestion(question: QuestionRow): RealtimeQuestion {
  return {
    id: question.id,
    title: question.title,
    description: question.description,
    course: question.course,
    yearLevel: question.yearLevel,
    subject: question.subject,
    lesson: question.lesson,
    tags: parseTags(question.tags),
    status: question.status,
    reviewStatus: question.reviewStatus,
    askerId: question.askerId,
    askerName: question.askerName,
    bestAnswerId: question.bestAnswerId,
    attachmentName: question.attachmentName,
    attachmentMime: question.attachmentMime,
    attachmentSize: question.attachmentSize,
    answerCount: question.answerCount,
    viewCount: question.viewCount,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  };
}

type AnswerRow = {
  id: string;
  questionId: string;
  text: string;
  answererId: string | null;
  answererName: string;
  verified: boolean;
  reviewStatus: string;
  voteCount: number;
  commentCount: number;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentSize: number;
  createdAt: Date;
};

export function toRealtimeAnswer(answer: AnswerRow): RealtimeAnswer {
  return {
    id: answer.id,
    questionId: answer.questionId,
    text: answer.text,
    answererId: answer.answererId,
    answererName: answer.answererName,
    verified: answer.verified,
    reviewStatus: answer.reviewStatus,
    voteCount: answer.voteCount,
    commentCount: answer.commentCount,
    // The name and type only. `attachmentKey` is deliberately absent — see the
    // note on RealtimeQuestion.
    attachmentName: answer.attachmentName,
    attachmentMime: answer.attachmentMime,
    attachmentSize: answer.attachmentSize,
    createdAt: answer.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type QuestionQuery = {
  search?: string;
  course?: string;
  yearLevel?: string;
  subject?: string;
  status?: string;
  tag?: string;
  askerId?: string;
  /** Moderators only — the review queue. Ignored for everyone else. */
  reviewStatus?: string;
  /**
   * Who is asking. Set by the route from the session, never from the query
   * string: it widens what comes back, and taking it from the URL would let
   * anyone read another person's unpublished questions by guessing an id.
   */
  viewerId?: string;
  page: number;
  pageSize: number;
};

/**
 * The shared board.
 *
 * Filtering happens in SQL against indexed columns — the portal used to load
 * every question and filter in JavaScript, which is fine for one browser's
 * worth of data and not for a whole college's.
 */
export async function listQuestions(query: QuestionQuery) {
  const where: Record<string, unknown> = { deletedAt: null };

  if (query.course) where.course = query.course;
  if (query.yearLevel) where.yearLevel = query.yearLevel;
  if (query.subject) where.subject = query.subject;
  if (query.status) where.status = query.status;
  if (query.askerId) where.askerId = query.askerId;

  /*
   * Publication.
   *
   * The board shows approved questions to everyone. On top of that, the asker
   * always sees their OWN question whatever its review state — otherwise you
   * ask something and it simply vanishes, with nothing to say it is waiting
   * rather than lost.
   *
   * `reviewStatus` is the moderator queue and is only reachable when the route
   * has confirmed the caller may review; nobody else can widen this beyond
   * their own rows.
   */
  if (query.reviewStatus) {
    where.reviewStatus = query.reviewStatus;
  } else if (query.viewerId) {
    where.AND = [
      {
        OR: [
          { reviewStatus: "APPROVED" },
          { askerId: query.viewerId },
        ],
      },
    ];
  } else {
    where.reviewStatus = "APPROVED";
  }

  if (query.search) {
    // Nested under AND so it cannot overwrite the publication filter above —
    // two bare `OR` keys on the same object would silently drop one.
    const search = {
      OR: [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
        { subject: { contains: query.search } },
      ],
    };

    where.AND = Array.isArray(where.AND) ? [...where.AND, search] : [search];
  }

  // `tags` is a JSON string, so this is a substring match on the encoded form.
  // Quoting the tag keeps "circuit" from matching "circuits".
  if (query.tag) {
    where.tags = { contains: `"${query.tag}"` };
  }

  const [total, questions] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { total, page: query.page, pageSize: query.pageSize, questions: questions.map(toRealtimeQuestion) };
}

/**
 * One question with its answers, newest-verified-and-most-voted first.
 *
 * `viewer` decides whether an unpublished question is reachable: its own asker
 * and a moderator may open it, nobody else. Without this the asker's own
 * pending question would appear in their list and then 404 on click.
 */
export async function getQuestionDetail(
  id: string,
  viewerId?: string | null,
  viewerRole?: string | null,
) {
  const question = await prisma.question.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(canReviewQuestions(viewerRole)
        ? {}
        : { OR: [{ reviewStatus: "APPROVED" }, { askerId: viewerId ?? "__none__" }] }),
    },
  });

  if (!question) return null;

  /*
   * Which answers this viewer may read.
   *
   * A pending answer is visible to its author — so a student can see that what
   * they wrote was received, and is waiting — and to the administrators who
   * have to judge it. Rejected answers are visible only to their author, with
   * the note explaining why, and to reviewers. Everyone else sees the published
   * ones and nothing else.
   *
   * This is the query, not a filter applied afterwards: an answer the viewer
   * may not read is never loaded, so there is no later step that could forget
   * to drop it.
   */
  const answers = await prisma.answer.findMany({
    where: {
      questionId: id,
      deletedAt: null,
      ...(canReviewAnswers(viewerRole)
        ? {}
        : { OR: [{ reviewStatus: "APPROVED" }, { answererId: viewerId ?? "__none__" }] }),
    },
    orderBy: [{ verified: "desc" }, { voteCount: "desc" }, { createdAt: "asc" }],
    include: {
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // Which of these the viewer has already voted for, in one query rather than
  // one per answer.
  const myVotes = viewerId
    ? new Set(
        (
          await prisma.answerVote.findMany({
            where: { userId: viewerId, answerId: { in: answers.map((a) => a.id) } },
            select: { answerId: true },
          })
        ).map((v) => v.answerId),
      )
    : new Set<string>();

  return {
    question: toRealtimeQuestion(question),
    answers: answers.map((answer) => ({
      ...toRealtimeAnswer(answer),
      votedByMe: myVotes.has(answer.id),
      comments: answer.comments.map((comment) => ({
        id: comment.id,
        answerId: comment.answerId,
        questionId: id,
        text: comment.text,
        commenterId: comment.commenterId,
        commenterName: comment.commenterName,
        createdAt: comment.createdAt.toISOString(),
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

/**
 * A file that has already been validated and written to storage.
 *
 * The route does the validating and the writing — the same `validateUpload` and
 * `saveFile` the library uses, so a renamed executable is rejected by its magic
 * bytes here exactly as it is there. This type is only the record of it.
 */
export type QaAttachment = {
  key: string;
  name: string;
  mime: string;
  size: number;
};

function attachmentColumns(attachment: QaAttachment | null | undefined) {
  if (!attachment) return {};

  return {
    attachmentKey: attachment.key,
    attachmentName: attachment.name,
    attachmentMime: attachment.mime,
    attachmentSize: attachment.size,
  };
}

/**
 * The storage key for one attachment, and only if this viewer may read it.
 *
 * Everything about who is allowed to see what lives here rather than in the
 * route, so the download and the page that links to it cannot disagree:
 *
 *   * a question's attachment follows the question — published, or yours, or
 *     you are a reviewer;
 *   * an answer's follows the answer, which adds the pending case: an answer
 *     awaiting review is readable by the person who wrote it and by the
 *     administrators who have to judge it, and by nobody else.
 */
export async function resolveAttachment(
  type: "question" | "answer",
  id: string,
  viewer: { id: string; role: string },
): Promise<{ key: string; name: string; mime: string } | null> {
  const moderator = canReviewAnswers(viewer.role);

  if (type === "question") {
    const question = await prisma.question.findFirst({
      where: { id, deletedAt: null, attachmentKey: { not: null } },
      select: { attachmentKey: true, attachmentName: true, attachmentMime: true, askerId: true, reviewStatus: true },
    });

    if (!question?.attachmentKey) return null;

    const allowed = moderator || question.reviewStatus === "APPROVED" || question.askerId === viewer.id;
    if (!allowed) return null;

    return {
      key: question.attachmentKey,
      name: question.attachmentName ?? "attachment",
      mime: question.attachmentMime ?? "application/octet-stream",
    };
  }

  const answer = await prisma.answer.findFirst({
    where: { id, deletedAt: null, attachmentKey: { not: null } },
    select: {
      attachmentKey: true,
      attachmentName: true,
      attachmentMime: true,
      answererId: true,
      reviewStatus: true,
      question: { select: { reviewStatus: true, askerId: true } },
    },
  });

  if (!answer?.attachmentKey) return null;

  const answerVisible =
    moderator || answer.reviewStatus === "APPROVED" || answer.answererId === viewer.id;
  const questionVisible =
    moderator ||
    answer.question.reviewStatus === "APPROVED" ||
    answer.question.askerId === viewer.id;

  if (!answerVisible || !questionVisible) return null;

  return {
    key: answer.attachmentKey,
    name: answer.attachmentName ?? "attachment",
    mime: answer.attachmentMime ?? "application/octet-stream",
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createQuestion(
  input: {
    title: string;
    description?: string;
    course?: string;
    yearLevel?: string;
    subject?: string;
    lesson?: string;
    tags?: string[];
    attachment?: QaAttachment | null;
  },
  actor: { id: string; name: string; role: string },
) {
  // Staff post straight to the board; a student's question waits for review.
  const approved = canReviewQuestions(actor.role);

  const question = await prisma.question.create({
    data: {
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      course: input.course || "CE",
      yearLevel: input.yearLevel || "",
      subject: input.subject || "",
      lesson: input.lesson || "",
      tags: JSON.stringify(input.tags ?? []),
      status: "Unanswered",
      askerId: actor.id,
      askerName: actor.name,
      reviewStatus: approved ? "APPROVED" : "PENDING",
      reviewedById: approved ? actor.id : null,
      reviewedAt: approved ? new Date() : null,
      ...attachmentColumns(input.attachment),
    },
  });

  if (approved) {
    emitRealtime("question:created", toRealtimeQuestion(question));
  } else {
    // Not broadcast — it is not on the board yet. Tell the people who can
    // publish it instead, so it does not sit in a queue nobody looks at.
    await notifyReviewers(question.title, actor.name);
  }

  return question;
}

/** Ping every account that can approve a question. */
async function notifyReviewers(title: string, askerName: string) {
  const reviewers = await prisma.user.findMany({
    where: { role: { in: [...QA_ANSWERER_ROLES] }, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });

  await Promise.all(
    reviewers.map((reviewer) =>
      createNotification({
        userId: reviewer.id,
        type: "QA_PENDING",
        title: "A question is waiting for review",
        body: `${askerName} asked: ${title}`,
        href: "/portal/index.html#qa",
        actorName: askerName,
      }),
    ),
  );
}

/** Ping every account that can publish a pending answer. */
async function notifyAnswerReviewers(questionTitle: string, answererName: string) {
  const reviewers = await prisma.user.findMany({
    where: { role: { in: [...QA_MODERATOR_ROLES] }, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });

  await Promise.all(
    reviewers.map((reviewer) =>
      createNotification({
        userId: reviewer.id,
        type: "QA_ANSWER_PENDING",
        title: "An answer is waiting for review",
        body: `${answererName} answered: ${questionTitle}`,
        href: "/portal/index.html#qa",
        actorName: answererName,
      }),
    ),
  );
}

/** Answers waiting to be published, for the reviewer's queue. */
export async function listPendingAnswers(role: string | null | undefined) {
  if (!canReviewAnswers(role)) {
    throw new UserServiceError("You do not have permission to review answers.", 403);
  }

  const rows = await prisma.answer.findMany({
    where: { reviewStatus: "PENDING", deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { question: { select: { id: true, title: true, subject: true, course: true } } },
  });

  return rows.map((row) => ({
    ...toRealtimeAnswer(row),
    questionTitle: row.question.title,
    questionSubject: row.question.subject,
    questionCourse: row.question.course,
  }));
}

/**
 * Publish or refuse a student's answer.
 *
 * The mirror of `reviewQuestion`, and deliberately shaped the same way: on
 * approval it emits `answer:created` — the answer's first appearance on
 * everyone's board — so a published answer travels the identical live path a
 * staff answer takes at creation, rather than through a second mechanism that
 * would have to be kept in step.
 */
export async function reviewAnswer(
  id: string,
  decision: "APPROVED" | "REJECTED",
  note: string | undefined,
  actor: { id: string; role: string },
) {
  if (!canReviewAnswers(actor.role)) {
    throw new UserServiceError("You do not have permission to review answers.", 403);
  }

  const existing = await prisma.answer.findFirst({
    where: { id, deletedAt: null },
    include: { question: { select: { id: true, title: true, status: true, askerId: true } } },
  });

  if (!existing) {
    throw new UserServiceError("That answer no longer exists.", 404);
  }

  if (existing.reviewStatus === decision) {
    throw new UserServiceError("That answer has already been reviewed.", 409);
  }

  /*
   * The counter moves with the decision, in both directions.
   *
   * Publishing a pending answer increments it; un-publishing one that was
   * already public decrements it. Doing only the first would leave the count
   * permanently high after a refusal — and `answerCount` exists precisely so
   * the card does not have to be trusted to a join.
   */
  const wasPublished = existing.reviewStatus === "APPROVED";
  const willPublish = decision === "APPROVED";
  const delta = willPublish && !wasPublished ? 1 : !willPublish && wasPublished ? -1 : 0;

  const [answer, question] = await prisma.$transaction([
    prisma.answer.update({
      where: { id },
      data: {
        reviewStatus: decision,
        rejectionNote: decision === "REJECTED" ? (note ?? null) : null,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
    }),
    prisma.question.update({
      where: { id: existing.questionId },
      data: {
        ...(delta !== 0 ? { answerCount: { increment: delta } } : {}),
        ...(willPublish && existing.question.status === "Unanswered"
          ? { status: "Answered" }
          : {}),
      },
    }),
  ]);

  if (willPublish) {
    emitRealtime("answer:created", toRealtimeAnswer(answer));
  } else {
    emitRealtime("answer:deleted", { id: answer.id, questionId: answer.questionId });
  }

  emitRealtime("question:updated", toRealtimeQuestion(question));

  // Tell the person who wrote it, either way — an answer that vanishes with no
  // explanation is worse than one that is refused with a reason.
  if (answer.answererId) {
    await createNotification({
      userId: answer.answererId,
      type: willPublish ? "QA_ANSWER_APPROVED" : "QA_ANSWER_REJECTED",
      title: willPublish ? "Your answer was published" : "Your answer was not published",
      body: willPublish
        ? existing.question.title
        : note?.trim() || "An administrator did not publish this answer.",
      href: `/portal/index.html#qa-${existing.questionId}`,
    });
  }

  // And tell the asker their question now has a reply they can read.
  if (willPublish && existing.question.askerId && existing.question.askerId !== answer.answererId) {
    await createNotification({
      userId: existing.question.askerId,
      type: "QA_ANSWER",
      title: `${answer.answererName} answered your question`,
      body: existing.question.title,
      href: `/portal/index.html#qa-${existing.questionId}`,
      actorName: answer.answererName,
    });
  }

  return answer;
}

/**
 * Publish or refuse a question.
 *
 * On approval this emits `question:created` — the question's first appearance
 * on everyone's board — so the live path is the same one a staff question
 * takes at creation, rather than a second code path to keep in step.
 */
export async function reviewQuestion(
  id: string,
  decision: "APPROVED" | "REJECTED",
  note: string | undefined,
  actor: { id: string; role: string },
) {
  if (!canReviewQuestions(actor.role)) {
    throw new UserServiceError("Only faculty and administrators can review questions.", 403);
  }

  const existing = await prisma.question.findFirst({ where: { id, deletedAt: null } });

  if (!existing) {
    throw new UserServiceError("That question no longer exists.", 404);
  }

  const question = await prisma.question.update({
    where: { id },
    data: {
      reviewStatus: decision,
      rejectionNote: decision === "REJECTED" ? (note ?? null) : null,
      reviewedById: actor.id,
      reviewedAt: new Date(),
    },
  });

  if (decision === "APPROVED") {
    emitRealtime("question:created", toRealtimeQuestion(question));
  } else {
    // Pull it from any board that already has it — a question approved and
    // then rejected has to disappear again.
    emitRealtime("question:deleted", { id: question.id, title: question.title });
  }

  if (question.askerId) {
    await createNotification({
      userId: question.askerId,
      type: decision === "APPROVED" ? "QA_APPROVED" : "QA_REJECTED",
      title:
        decision === "APPROVED"
          ? "Your question is now on the board"
          : "Your question was not published",
      body: decision === "REJECTED" ? (note ?? "No reason given.") : question.title,
      href: `/portal/index.html#qa-${question.id}`,
    });
  }

  return question;
}

export async function addAnswer(
  questionId: string,
  text: string,
  actor: { id: string; name: string; role: string },
  attachment?: QaAttachment | null,
) {
  if (!canAnswerQuestions(actor.role)) {
    throw new UserServiceError("Your account cannot answer questions.", 403);
  }

  const question = await prisma.question.findFirst({
    where: { id: questionId, deletedAt: null },
  });

  if (!question) {
    throw new UserServiceError("That question no longer exists.", 404);
  }

  // An unpublished question cannot be answered — it is not on the board yet.
  if (question.reviewStatus !== "APPROVED") {
    throw new UserServiceError("That question is still waiting for review.", 409);
  }

  // Staff answers go up immediately; everyone else's waits for an administrator.
  const published = canAnswerWithoutReview(actor.role);

  /*
   * `answerCount` counts what people can actually read.
   *
   * A pending answer must not bump it, or the card says "1 answer" and opens
   * to an empty thread for everybody except its author — which is the same
   * class of lie the counter was denormalised to avoid. It is incremented on
   * approval instead.
   */
  const [answer, updatedQuestion] = await prisma.$transaction([
    prisma.answer.create({
      data: {
        questionId,
        text: text.trim(),
        answererId: actor.id,
        answererName: actor.name,
        reviewStatus: published ? "APPROVED" : "PENDING",
        reviewedById: published ? actor.id : null,
        reviewedAt: published ? new Date() : null,
        ...attachmentColumns(attachment),
      },
    }),
    prisma.question.update({
      where: { id: questionId },
      data: {
        ...(published ? { answerCount: { increment: 1 } } : {}),
        // Only lift "Unanswered". A question already Verified or Solved must
        // not be dragged back down by a new reply.
        ...(published && question.status === "Unanswered" ? { status: "Answered" } : {}),
      },
    }),
  ]);

  if (published) {
    emitRealtime("answer:created", toRealtimeAnswer(answer));
    emitRealtime("question:updated", toRealtimeQuestion(updatedQuestion));
  } else {
    // Not broadcast — nobody else may see it yet. The reviewers are told
    // instead, the same way a pending question tells them.
    await notifyAnswerReviewers(question.title, actor.name);
  }

  // Tell the asker, unless they answered their own question — and only once the
  // answer is something they can actually open.
  if (published && question.askerId && question.askerId !== actor.id) {
    await createNotification({
      userId: question.askerId,
      type: "QA_ANSWER",
      title: `${actor.name} answered your question`,
      body: question.title,
      href: `/portal/index.html#qa-${question.id}`,
      actorName: actor.name,
    });
  }

  return answer;
}

/**
 * Toggle this user's vote on an answer.
 *
 * The unique index on (answerId, userId) is what actually enforces one vote per
 * person — this reads it first only to decide which way to toggle.
 */
export async function toggleAnswerVote(answerId: string, userId: string) {
  const answer = await prisma.answer.findFirst({
    where: { id: answerId, deletedAt: null },
  });

  if (!answer) {
    throw new UserServiceError("That answer no longer exists.", 404);
  }

  const existing = await prisma.answerVote.findUnique({
    where: { answerId_userId: { answerId, userId } },
  });

  const [, updated] = existing
    ? await prisma.$transaction([
        prisma.answerVote.delete({ where: { id: existing.id } }),
        prisma.answer.update({
          where: { id: answerId },
          data: { voteCount: { decrement: 1 } },
        }),
      ])
    : await prisma.$transaction([
        prisma.answerVote.create({ data: { answerId, userId } }),
        prisma.answer.update({
          where: { id: answerId },
          data: { voteCount: { increment: 1 } },
        }),
      ]);

  emitRealtime("answer:updated", toRealtimeAnswer(updated));

  return { voted: !existing, voteCount: updated.voteCount };
}

export async function addAnswerComment(
  answerId: string,
  text: string,
  actor: { id: string; name: string },
) {
  const answer = await prisma.answer.findFirst({
    where: { id: answerId, deletedAt: null },
    select: { id: true, questionId: true, answererId: true },
  });

  if (!answer) {
    throw new UserServiceError("That answer no longer exists.", 404);
  }

  const [comment] = await prisma.$transaction([
    prisma.answerComment.create({
      data: {
        answerId,
        text: text.trim(),
        commenterId: actor.id,
        commenterName: actor.name,
      },
    }),
    prisma.answer.update({
      where: { id: answerId },
      data: { commentCount: { increment: 1 } },
    }),
  ]);

  const payload: RealtimeAnswerComment = {
    id: comment.id,
    answerId,
    questionId: answer.questionId,
    text: comment.text,
    commenterId: comment.commenterId,
    commenterName: comment.commenterName,
    createdAt: comment.createdAt.toISOString(),
  };

  emitRealtime("answer:comment", payload);

  return comment;
}

/**
 * Mark an answer as the accepted one.
 *
 * Allowed for the asker (it is their question) or a moderator. `verified` — the
 * badge that says a faculty member vouched for it — is only ever set by a
 * moderator, so a student cannot self-certify their own answer.
 */
export async function acceptAnswer(
  answerId: string,
  actor: { id: string; role: string; name: string },
) {
  const answer = await prisma.answer.findFirst({
    where: { id: answerId, deletedAt: null },
    include: { question: true },
  });

  if (!answer || !answer.question || answer.question.deletedAt) {
    throw new UserServiceError("That answer no longer exists.", 404);
  }

  const isAsker = answer.question.askerId === actor.id;
  const isModerator = canVerifyAnswers(actor.role);

  if (!isAsker && !isModerator) {
    throw new UserServiceError(
      "Only the person who asked, or a faculty member, can accept an answer.",
      403,
    );
  }

  const [updatedAnswer, updatedQuestion] = await prisma.$transaction([
    prisma.answer.update({
      where: { id: answerId },
      data: isModerator
        ? { verified: true, verifiedById: actor.id, verifiedAt: new Date() }
        : {},
    }),
    prisma.question.update({
      where: { id: answer.questionId },
      data: {
        bestAnswerId: answerId,
        status: isModerator ? "Verified Answer" : "Solved",
      },
    }),
  ]);

  emitRealtime("answer:updated", toRealtimeAnswer(updatedAnswer));
  emitRealtime("question:updated", toRealtimeQuestion(updatedQuestion));

  if (answer.answererId && answer.answererId !== actor.id) {
    await createNotification({
      userId: answer.answererId,
      type: "QA_ACCEPTED",
      title: isModerator ? "Your answer was verified" : "Your answer was accepted",
      body: answer.question.title,
      href: `/portal/index.html#qa-${answer.questionId}`,
      actorName: actor.name,
    });
  }

  return { answer: updatedAnswer, question: updatedQuestion };
}

/**
 * Count a view.
 *
 * NOT deduplicated per person — the docstring here used to claim it was, and it
 * never has been: there is no `QuestionView` table to record who has already
 * looked, the way `MaterialView` does for the library. So a signed-in user who
 * replays the "view" action inflates the number. That is cosmetic (the counter
 * decides nothing) and fixing it properly needs a migration, so it is written
 * down rather than quietly wrong.
 *
 * `_userId` is kept so the call site does not change when that table arrives.
 */
export async function recordQuestionView(questionId: string, _userId: string) {
  const question = await prisma.question.findFirst({
    where: { id: questionId, deletedAt: null },
    select: { id: true },
  });

  if (!question) return { counted: false };

  const updated = await prisma.question.update({
    where: { id: questionId },
    data: { viewCount: { increment: 1 } },
  });

  // Not broadcast: a view count ticking up is not worth waking every open
  // board, and the number is refreshed on the next load anyway.
  return { counted: true, viewCount: updated.viewCount };
}

/**
 * Delete a question. The asker may remove their own; moderators may remove any.
 * Soft delete, so a wrongly-removed question can be recovered from the database.
 */
export async function deleteQuestion(id: string, actor: { id: string; role: string }) {
  const question = await prisma.question.findFirst({ where: { id, deletedAt: null } });

  if (!question) {
    throw new UserServiceError("That question no longer exists.", 404);
  }

  if (question.askerId !== actor.id && !canVerifyAnswers(actor.role)) {
    throw new UserServiceError("Only the person who asked, or a moderator, can delete this.", 403);
  }

  await prisma.question.update({ where: { id }, data: { deletedAt: new Date() } });

  emitRealtime("question:deleted", { id, title: question.title });

  return { id };
}

export async function deleteAnswer(id: string, actor: { id: string; role: string }) {
  const answer = await prisma.answer.findFirst({ where: { id, deletedAt: null } });

  if (!answer) {
    throw new UserServiceError("That answer no longer exists.", 404);
  }

  if (answer.answererId !== actor.id && !canVerifyAnswers(actor.role)) {
    throw new UserServiceError("Only the author, or a moderator, can delete this answer.", 403);
  }

  await prisma.$transaction([
    prisma.answer.update({ where: { id }, data: { deletedAt: new Date() } }),
    prisma.question.update({
      where: { id: answer.questionId },
      // Floor at zero: a legacy row with a drifted counter must not go negative.
      data: { answerCount: { decrement: 1 } },
    }),
  ]);

  await prisma.question.updateMany({
    where: { id: answer.questionId, answerCount: { lt: 0 } },
    data: { answerCount: 0 },
  });

  emitRealtime("answer:deleted", { id, questionId: answer.questionId });

  return { id };
}


