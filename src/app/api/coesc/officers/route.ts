/**
 * GET /api/coesc/officers — the student council roster.
 *
 * Open to every signed-in account. The council is public information inside the
 * college and the whole tab is meant to be seen by everyone; only *editing* is
 * restricted, and that lives on the PATCH route.
 */

import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { listOfficers, canManageCouncil, COMMITTEES, COUNCIL_TIERS } from "@/lib/coesc";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in to view the council." }, { status: 401 });
  }

  try {
    const officers = await listOfficers();

    return NextResponse.json({
      officers,
      // The org chart's levels, so the front-end draws the hierarchy the server
      // describes instead of hardcoding a second copy of it.
      tiers: COUNCIL_TIERS,
      committees: COMMITTEES,
      // Lets the client render the edit affordances without a second call, and
      // without guessing from the role string it holds.
      canManage: canManageCouncil(auth.user.role),
    });
  } catch (error) {
    console.error("[api/coesc/officers] GET", error);
    return NextResponse.json({ message: "Could not load the council." }, { status: 500 });
  }
}
