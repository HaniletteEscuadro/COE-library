/**
 * GET /api/csrf
 *
 * Issues a double-submit CSRF token: the same value is set as an httpOnly
 * cookie and returned in the body. State-changing routes then require the
 * caller to echo it back in the `x-csrf-token` header.
 *
 * This works because a cross-origin attacker can cause the browser to *send*
 * the cookie, but cannot read it in order to set the matching header.
 */

import { createCsrfResponse } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  return createCsrfResponse();
}
