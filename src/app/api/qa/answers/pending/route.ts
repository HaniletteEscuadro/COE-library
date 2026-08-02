/**
 * GET /api/qa/answers/pending — student answers waiting to be published.
 *
 * Its own endpoint rather than a parameter on the question list, because it
 * crosses questions: a reviewer wants one queue of everything waiting, not to
 * open forty threads looking for it.
 *
 * Administrator-only, enforced inside `listPendingAnswers`.
 */

import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { listPendingAnswers } from "@/lib/qa";
import { UserServiceError } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  try {
    return NextResponse.json({ answers: await listPendingAnswers(auth.user.role) });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/qa/answers/pending] GET", error);
    return NextResponse.json({ message: "Could not load the queue." }, { status: 500 });
  }
}
