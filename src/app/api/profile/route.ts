/**
 * GET   /api/profile — the signed-in user's own record
 * PATCH /api/profile — update own name/course, or change own password
 *
 * Distinct from `/api/admin/users/[id]`: this only ever touches the caller's
 * own row, and cannot change role or status. A user editing themselves must
 * not be able to promote themselves.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuth } from "@/lib/session";
import {
  hashPassword,
  verifyPassword,
  recordLoginEvent,
  revokeAllSessionsForUser,
  getIpFromHeaders,
  getUserAgentFromHeaders,
  verifyCsrf,
  csrfError,
} from "@/lib/security";
import { emitRealtime, toRealtimeUser } from "@/lib/realtime";
import { changePasswordSchema, profileSchema, formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: auth.user.id,
      name: auth.user.name,
      username: auth.user.username,
      email: auth.user.email,
      role: auth.user.role,
      discipline: auth.user.discipline,
      createdAt: auth.user.createdAt,
      lastLoginAt: auth.user.lastLoginAt,
      loginCount: auth.user.loginCount,
      hasPassword: auth.user.hasPassword,
      passwordChangedAt: auth.user.passwordChangedAt,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  let body: { action?: string; [key: string]: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const ipAddress = getIpFromHeaders(request.headers);
  const userAgent = getUserAgentFromHeaders(request.headers);

  // --- Change password --------------------------------------------------
  if (body.action === "password") {
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      const { message, fieldErrors } = formatZodError(parsed.error);
      return NextResponse.json({ message, fieldErrors }, { status: 400 });
    }

    // Read the hash directly — `getCurrentAuth` strips it on purpose.
    const record = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { passwordHash: true, email: true, username: true },
    });

    if (!record?.passwordHash) {
      return NextResponse.json(
        { message: "This account has no password set. Use the reset link instead." },
        { status: 409 },
      );
    }

    // Requiring the current password is what stops someone who walks up to an
    // unlocked laptop from taking the account over.
    const valid = await verifyPassword(parsed.data.currentPassword, record.passwordHash);

    if (!valid) {
      await recordLoginEvent({
        type: "PASSWORD_CHANGE",
        userId: auth.user.id,
        email: record.email,
        username: record.username,
        ipAddress,
        userAgent,
        detail: "Rejected: current password did not match",
      });

      return NextResponse.json(
        { message: "That is not your current password.", fieldErrors: { currentPassword: "Incorrect." } },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        passwordChangedAt: new Date(),
      },
    });

    // Sign out everywhere else. The current session is included, so the user
    // signs in again — the safe default when a credential changes.
    await revokeAllSessionsForUser(auth.user.id, "Password changed");

    await recordLoginEvent({
      type: "PASSWORD_CHANGE",
      success: true,
      userId: auth.user.id,
      email: record.email,
      username: record.username,
      ipAddress,
      userAgent,
      detail: "Password changed from the profile page",
    });

    return NextResponse.json({
      message: "Password changed. Please sign in again.",
      signedOut: true,
    });
  }

  // --- Update profile ----------------------------------------------------
  const parsed = profileSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  // Note what is absent: role, status, email, username. Those are admin-only
  // or identity-critical and are not editable here.
  const user = await prisma.user.update({
    where: { id: auth.user.id },
    data: {
      name: parsed.data.name,
      discipline: parsed.data.discipline || null,
      ...(parsed.data.image !== undefined ? { image: parsed.data.image || null } : {}),
    },
    select: {
      id: true, name: true, username: true, email: true, role: true, status: true,
      discipline: true, image: true, emailVerified: true, createdAt: true,
      lastLoginAt: true, lastLoginIp: true, loginCount: true,
    },
  });

  // Keep any open admin dashboard in step.
  emitRealtime("user:updated", toRealtimeUser(user));

  await recordLoginEvent({
    type: "PROFILE_UPDATED",
    success: true,
    userId: user.id,
    email: user.email,
    username: user.username,
    ipAddress,
    userAgent,
    detail: "Updated own profile",
  });

  return NextResponse.json({ message: "Profile updated.", user });
}
