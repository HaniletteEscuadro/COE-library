/**
 * GET /api/coesc/approvals — everything waiting on a decision.
 *
 * Questions, uploaded materials and committee applications in one response, so
 * a reviewer has one queue instead of three screens that each have to be
 * remembered.
 *
 * Reviewers only (ADMIN or REGISTRAR); `listPendingApprovals` enforces it.
 */

import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { listPendingApprovals } from "@/lib/coesc";
import { UserServiceError } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  try {
    const queue = await listPendingApprovals({
      id: auth.user.id,
      name: auth.user.name,
      role: auth.user.role,
    });

    return NextResponse.json(queue);
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/coesc/approvals] GET", error);
    return NextResponse.json({ message: "Could not load the approvals queue." }, { status: 500 });
  }
}
