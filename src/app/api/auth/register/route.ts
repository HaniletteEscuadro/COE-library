/**
 * POST /api/auth/register
 *
 * Public sign-up. Creates the account, logs the event with device/IP details,
 * and broadcasts it so any open admin dashboard shows the new row immediately —
 * which is the "new account appears without refreshing" requirement.
 *
 * All of that happens inside `registerUser`; this handler only validates the
 * request and maps errors onto status codes.
 */

import { NextResponse, type NextRequest } from "next/server";
import { registerUser, UserServiceError } from "@/lib/users";
import { registerSchema, formatZodError } from "@/lib/validation";
import {
  getIpFromHeaders,
  getRegistrationRateLimit,
  getUserAgentFromHeaders,
  verifyCsrf,
  csrfError,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // CSRF first: registration is a state-changing POST reachable from any origin.
  if (!verifyCsrf(request)) {
    return csrfError();
  }

  const ipAddress = getIpFromHeaders(request.headers);

  // Then throttle, before any work is done. This endpoint is unauthenticated
  // and writes on every successful call, so it is the cheapest way for someone
  // to fill the database and bury the admin activity feed. CSRF does not help:
  // /api/csrf hands a token to anyone who asks.
  const rateLimit = await getRegistrationRateLimit(ipAddress);

  if (rateLimit.limited) {
    return NextResponse.json(
      {
        message:
          "Too many accounts have been created from this network recently. " +
          "Try again later, or ask an administrator to create the account.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterMinutes * 60) },
      },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  const { name, username, email, password, discipline } = parsed.data;

  try {
    const user = await registerUser(
      { name, username, email, password, discipline },
      {
        ipAddress,
        userAgent: getUserAgentFromHeaders(request.headers),
      },
    );

    // Never return the whole row — it carries the password hash.
    return NextResponse.json(
      {
        message: "Account created. You can sign in now.",
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json(
        { message: error.message, fieldErrors: error.field ? { [error.field]: error.message } : {} },
        { status: error.status },
      );
    }

    console.error("[api/auth/register]", error);

    return NextResponse.json(
      { message: "Could not create the account. Try again." },
      { status: 500 },
    );
  }
}
