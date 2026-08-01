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
 * Who may post an answer.
 *
 * "Tanong Mo, Sagot Ko" is a board where students ask and staff reply — the
 * page has always said "Please wait for an official reply" and hidden the
 * answer box from everyone else. Until now that was only the UI hiding it, so
 * anyone who called the API directly could answer anyway. This is the rule
 * being enforced where it counts.
 */
const QA_ANSWERER_ROLES = ["ADMIN", "FACULTY"] as const;

export function canAnswerQuestions(role: string | null | undefined) {
  return hasRole(role, QA_ANSWERER_ROLES);
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
  voteCount: number;
  commentCount: number;
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
    voteCount: answer.voteCount,
    commentCount: answer.commentCount,
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

  const answers = await prisma.answer.findMany({
    where: { questionId: id, deletedAt: null },
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
) {
  // The rule the page has always claimed, now actually enforced. Hiding the
  // answer box in the UI was never a permission check.
  if (!canAnswerQuestions(actor.role)) {
    throw new UserServiceError(
      "Only faculty and administrators can answer questions.",
      403,
    );
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

  // The answer and the parent's counter move together, so the card can never
  // show "0 answers" next to a visible answer.
  const [answer, updatedQuestion] = await prisma.$transaction([
    prisma.answer.create({
      data: {
        questionId,
        text: text.trim(),
        answererId: actor.id,
        answererName: actor.name,
      },
    }),
    prisma.question.update({
      where: { id: questionId },
      data: {
        answerCount: { increment: 1 },
        // Only lift "Unanswered". A question already Verified or Solved must
        // not be dragged back down by a new reply.
        ...(question.status === "Unanswered" ? { status: "Answered" } : {}),
      },
    }),
  ]);

  emitRealtime("answer:created", toRealtimeAnswer(answer));
  emitRealtime("question:updated", toRealtimeQuestion(updatedQuestion));

  // Tell the asker, unless they answered their own question.
  if (question.askerId && question.askerId !== actor.id) {
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


