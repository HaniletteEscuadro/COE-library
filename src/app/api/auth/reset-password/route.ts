/**
 * POST /api/auth/reset-password
 *
 * Consumes a reset token and sets a new password.
 *
 * `consumeSecurityToken` marks the token used inside the same call that reads
 * it, so a link cannot be replayed. Every live session is then revoked: if the
 * reset was triggered because the account was compromised, leaving the
 * attacker's session alive would defeat the point.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  consumeSecurityToken,
  getIpFromHeaders,
  getUserAgentFromHeaders,
  hashPassword,
  recordLoginEvent,
  revokeAllSessionsForUser,
  verifyCsrf,
  csrfError,
} from "@/lib/security";
import { resetPasswordSchema, formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request)) return csrfError();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  const ipAddress = getIpFromHeaders(request.headers);
  const userAgent = getUserAgentFromHeaders(request.headers);

  try {
    // Single-use: this both validates and burns the token.
    const user = await consumeSecurityToken(parsed.data.token, "PASSWORD_RESET");

    if (!user) {
      return NextResponse.json(
        { message: "That reset link is invalid or has expired. Request a new one." },
        { status: 400 },
      );
    }

    if (user.deletedAt || user.status !== "ACTIVE") {
      return NextResponse.json(
        { message: "This account cannot be reset. Contact an administrator." },
        { status: 403 },
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        passwordChangedAt: new Date(),
        // A successful reset clears any lockout from the failed attempts that
        // probably prompted it.
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    // Anyone already signed in as this user is signed out.
    await revokeAllSessionsForUser(user.id, "Password was reset");

    await recordLoginEvent({
      type: "PASSWORD_RESET",
      success: true,
      userId: user.id,
      email: user.email,
      username: user.username,
      ipAddress,
      userAgent,
      detail: "Password reset via emailed link",
    });

    return NextResponse.json({ message: "Password updated. You can sign in now." });
  } catch (error) {
    console.error("[api/auth/reset-password]", error);
    return NextResponse.json({ message: "Could not reset the password." }, { status: 500 });
  }
}
