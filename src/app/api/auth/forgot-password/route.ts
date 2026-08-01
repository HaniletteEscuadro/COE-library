/**
 * POST /api/auth/forgot-password
 *
 * Issues a single-use reset token.
 *
 * Two things are deliberate here:
 *
 *   1. The response is identical whether or not the email exists. Telling the
 *      caller "no such account" turns this endpoint into a way to enumerate
 *      who has registered.
 *   2. Until SMTP is configured the link is returned in the response body in
 *      development only. In production it is withheld — otherwise anyone could
 *      request a reset for any address and read the link straight back.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSecurityToken,
  getIpFromHeaders,
  getUserAgentFromHeaders,
  normalizeEmail,
  recordLoginEvent,
  verifyCsrf,
  csrfError,
} from "@/lib/security";
import { forgotPasswordSchema, formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Reset links are short-lived; an old one sitting in an inbox is a liability. */
const TTL_MINUTES = 30;

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request)) return csrfError();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const ipAddress = getIpFromHeaders(request.headers);
  const userAgent = getUserAgentFromHeaders(request.headers);

  // Same wording on every path.
  const genericResponse = {
    message: "If that email is registered, a reset link has been created.",
  };

  try {
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, email: true, username: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      // Still record the attempt — repeated misses against unknown addresses
      // are worth seeing in the activity log.
      await recordLoginEvent({
        type: "PASSWORD_RESET_REQUESTED",
        email,
        ipAddress,
        userAgent,
        detail: user ? `Blocked: account is ${user.status}` : "No matching account",
      });

      return NextResponse.json(genericResponse);
    }

    const token = await createSecurityToken({
      userId: user.id,
      type: "PASSWORD_RESET",
      ttlMinutes: TTL_MINUTES,
    });

    await recordLoginEvent({
      type: "PASSWORD_RESET_REQUESTED",
      success: true,
      userId: user.id,
      email: user.email,
      username: user.username,
      ipAddress,
      userAgent,
      detail: `Reset link issued (valid ${TTL_MINUTES} minutes)`,
    });

    const resetUrl = `${process.env.NEXTAUTH_URL ?? ""}/auth/reset?token=${token}`;

    // Development convenience only. Returning this in production would let
    // anyone reset anyone's password.
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ...genericResponse, devResetUrl: resetUrl });
    }

    // TODO: send `resetUrl` by email once SMTP is configured.
    console.log(`[auth] password reset link for ${email}: ${resetUrl}`);

    return NextResponse.json(genericResponse);
  } catch (error) {
    console.error("[api/auth/forgot-password]", error);
    // Even on failure, do not reveal anything about the address.
    return NextResponse.json(genericResponse);
  }
}
