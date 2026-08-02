/**
 * GET  /api/qa/questions — the shared Q&A board
 * POST /api/qa/questions — ask a question
 *
 * Every signed-in account queries the same table, which is the whole point:
 * a question asked on one laptop is now visible on every other one, and the
 * answer count on a card is the real count rather than one browser's.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { verifyCsrf, csrfError } from "@/lib/security";
import {
  canReviewQuestions,
  createQuestion,
  listQuestions,
  QUESTION_STATUSES,
  type QaAttachment,
} from "@/lib/qa";
import { readQaAttachment } from "@/lib/qa-upload";
import { UploadValidationError } from "@/lib/upload";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  search: z.string().trim().max(120).optional(),
  course: z.string().trim().max(40).optional(),
  yearLevel: z.string().trim().max(40).optional(),
  subject: z.string().trim().max(160).optional(),
  status: z.enum(QUESTION_STATUSES).optional(),
  reviewStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  tag: z.string().trim().max(40).optional(),
  askerId: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
});

const createSchema = z.object({
  title: z.string().trim().min(5, "Give the question a clear title.").max(200),
  description: z.string().trim().max(4000).optional().default(""),
  course: z.string().trim().max(40).optional().default("CE"),
  yearLevel: z.string().trim().max(40).optional().default(""),
  subject: z.string().trim().max(160).optional().default(""),
  lesson: z.string().trim().max(160).optional().default(""),
  tags: z.array(z.string().trim().max(40)).max(10).optional().default([]),
});

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in to view the Q&A board." }, { status: 401 });
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid query." },
      { status: 400 },
    );
  }

  // The review queue is moderators-only. Dropping the parameter rather than
  // erroring means a student who crafts ?reviewStatus=PENDING simply gets the
  // normal board — approved questions plus their own.
  const canReview = canReviewQuestions(auth.user.role);

  try {
    return NextResponse.json(
      await listQuestions({
        ...parsed.data,
        reviewStatus: canReview ? parsed.data.reviewStatus : undefined,
        // From the session, never the query string.
        viewerId: auth.user.id,
      }),
    );
  } catch (error) {
    console.error("[api/qa/questions] GET", error);
    return NextResponse.json({ message: "Could not load questions." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in to ask a question." }, { status: 401 });
  }

  if (!verifyCsrf(request)) {
    return csrfError();
  }

  /*
   * JSON or multipart.
   *
   * The portal's ask form has always had a file picker, and until now the only
   * accepted body was JSON — so the browser read the file, and the request that
   * followed had no room to carry it. Multipart is what a file needs; JSON is
   * kept because every other caller sends it and there is no reason to break
   * them for the sake of one field.
   */
  const contentType = request.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  let body: unknown;
  let attachment: QaAttachment | null = null;

  if (isMultipart) {
    let form: FormData;

    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ message: "Could not read the upload." }, { status: 400 });
    }

    body = {
      title: form.get("title") ?? "",
      description: form.get("description") ?? "",
      course: form.get("course") ?? "CE",
      yearLevel: form.get("yearLevel") ?? "",
      subject: form.get("subject") ?? "",
      lesson: form.get("lesson") ?? "",
      // Sent comma-separated by a form; the schema wants an array.
      tags: String(form.get("tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    try {
      attachment = await readQaAttachment(form);
    } catch (error) {
      if (error instanceof UploadValidationError) {
        return NextResponse.json({ message: error.message, code: error.code }, { status: 400 });
      }
      throw error;
    }
  } else {
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }
  }

  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Check the question details." },
      { status: 400 },
    );
  }

  try {
    const question = await createQuestion({ ...parsed.data, attachment }, {
      id: auth.user.id,
      name: auth.user.name ?? auth.user.username ?? "COE user",
      role: auth.user.role,
    });

    const queued = question.reviewStatus !== "APPROVED";

    return NextResponse.json(
      {
        message: queued
          ? "Sent for review. It appears on the board once a faculty member approves it."
          : "Question posted.",
        id: question.id,
        reviewStatus: question.reviewStatus,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api/qa/questions] POST", error);
    return NextResponse.json({ message: "Could not post the question." }, { status: 500 });
  }
}
