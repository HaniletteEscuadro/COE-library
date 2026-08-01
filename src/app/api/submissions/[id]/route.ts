/**
 * GET   /api/submissions/[id] — read one (author or staff only)
 * PATCH /api/submissions/[id] — grade and return it (staff only)
 *
 * `getSubmission` answers 404 rather than 403 when an unrelated student asks:
 * a 403 would confirm the submission exists, which itself reveals that the
 * other student handed something in.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { getSubmission, gradeSubmission } from "@/lib/submissions";
import { UserServiceError } from "@/lib/users";
import { submissionGradeSchema, formatZodError } from "@/lib/validation";
import { verifyCsrf, csrfError, getIpFromHeaders, getUserAgentFromHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/submissions/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const submission = await getSubmission(id, { id: auth.user.id, role: auth.user.role });

    return NextResponse.json({
      submission: {
        id: submission.id,
        assignmentId: submission.assignmentId,
        assignmentTitle: submission.assignment.title,
        points: submission.assignment.points,
        content: submission.content,
        originalName: submission.originalName,
        sizeBytes: submission.sizeBytes,
        status: submission.status,
        isLate: submission.isLate,
        score: submission.score,
        feedback: submission.feedback,
        gradedAt: submission.gradedAt?.toISOString() ?? null,
        submittedAt: submission.submittedAt.toISOString(),
        studentId: submission.studentId,
        studentName: submission.student?.name ?? submission.student?.username ?? null,
      },
    });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/submissions/:id] GET", error);
    return NextResponse.json({ message: "Could not load the submission." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/submissions/[id]">) {
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

  const parsed = submissionGradeSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  try {
    // The staff check and the score bound (against the assignment's own
    // `points`) both live in the service.
    const submission = await gradeSubmission(id, parsed.data, {
      actorId: auth.user.id,
      actorName: auth.user.name ?? auth.user.username,
      role: auth.user.role,
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    });

    return NextResponse.json({
      message: "Graded. The student has been notified.",
      submission: { id: submission.id, score: submission.score, status: submission.status },
    });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message, field: error.field }, { status: error.status });
    }

    console.error("[api/submissions/:id] PATCH", error);
    return NextResponse.json({ message: "Could not grade the submission." }, { status: 500 });
  }
}
