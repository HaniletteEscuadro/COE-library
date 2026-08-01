/**
 * GET    /api/qa/questions/[id] — one question with its answers and comments
 * POST   /api/qa/questions/[id] — one interaction, chosen by `action`
 * DELETE /api/qa/questions/[id] — remove (soft) a question
 *
 * The interactions are collapsed into one endpoint for the same reason the
 * library's are: they share auth, CSRF and the lookup, and differ only in which
 * service call runs.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { verifyCsrf, csrfError } from "@/lib/security";
import {
  acceptAnswer,
  addAnswer,
  addAnswerComment,
  deleteAnswer,
  deleteQuestion,
  getQuestionDetail,
  recordQuestionView,
  reviewQuestion,
  toggleAnswerVote,
} from "@/lib/qa";
import { UserServiceError } from "@/lib/users";
import { z } from "zod";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("answer"), text: z.string().trim().min(2, "Write an answer first.").max(4000) }),
  z.object({ action: z.literal("vote"), answerId: z.string().trim().min(1) }),
  z.object({
    action: z.literal("comment"),
    answerId: z.string().trim().min(1),
    text: z.string().trim().min(1, "Write a comment first.").max(1000),
  }),
  z.object({ action: z.literal("accept"), answerId: z.string().trim().min(1) }),
  z.object({ action: z.literal("view") }),
  z.object({ action: z.literal("delete-answer"), answerId: z.string().trim().min(1) }),
  z.object({
    action: z.literal("review"),
    decision: z.enum(["APPROVED", "REJECTED"]),
    note: z.string().trim().max(500).optional(),
  }),
]);

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/qa/questions/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const detail = await getQuestionDetail(id, auth.user.id, auth.user.role);

  if (!detail) {
    return NextResponse.json({ message: "That question is not available." }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/qa/questions/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = actionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Unknown action." },
      { status: 400 },
    );
  }

  // `view` fires on every open and is not something the user chose, so it is
  // exempt — the same rule the library route uses.
  if (parsed.data.action !== "view" && !verifyCsrf(request)) {
    return csrfError();
  }

  const actor = {
    id: auth.user.id,
    role: auth.user.role,
    name: auth.user.name ?? auth.user.username ?? "COE user",
  };

  try {
    switch (parsed.data.action) {
      case "answer": {
        const answer = await addAnswer(id, parsed.data.text, actor);
        return NextResponse.json({ message: "Answer posted.", id: answer.id }, { status: 201 });
      }

      case "vote":
        return NextResponse.json(await toggleAnswerVote(parsed.data.answerId, actor.id));

      case "comment": {
        const comment = await addAnswerComment(parsed.data.answerId, parsed.data.text, actor);
        return NextResponse.json({ message: "Comment added.", id: comment.id }, { status: 201 });
      }

      case "accept": {
        await acceptAnswer(parsed.data.answerId, actor);
        return NextResponse.json({ message: "Answer accepted." });
      }

      case "delete-answer":
        return NextResponse.json(await deleteAnswer(parsed.data.answerId, actor));

      case "view":
        return NextResponse.json(await recordQuestionView(id, actor.id));

      case "review": {
        // `reviewQuestion` owns the permission check, so it cannot be bypassed
        // by any other caller of that function.
        const question = await reviewQuestion(id, parsed.data.decision, parsed.data.note, actor);

        return NextResponse.json({
          message:
            parsed.data.decision === "APPROVED"
              ? `"${question.title}" is now on the board.`
              : `"${question.title}" was not published.`,
          reviewStatus: question.reviewStatus,
        });
      }
    }
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/qa/questions/:id]", error);
    return NextResponse.json({ message: "Could not complete that action." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/qa/questions/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!verifyCsrf(request)) {
    return csrfError();
  }

  const { id } = await ctx.params;

  try {
    return NextResponse.json(
      await deleteQuestion(id, { id: auth.user.id, role: auth.user.role }),
    );
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/qa/questions/:id] DELETE", error);
    return NextResponse.json({ message: "Could not delete that question." }, { status: 500 });
  }
}
