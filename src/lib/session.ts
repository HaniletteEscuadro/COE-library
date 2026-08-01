import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/rbac";
import type { UserRole } from "@/lib/enums";

/**
 * Resolve the caller's identity, re-validating against the database.
 *
 * The JWT alone is not sufficient. It is signed and unexpired for up to 30
 * days, so an account that an admin disables, bans, deletes, or demotes would
 * otherwise keep working until it expires. Every protected request therefore
 * re-reads the user and their session row and returns `null` the moment either
 * stops being valid.
 *
 * Returns `null` rather than redirecting so API routes can answer 401 while
 * pages redirect — see `requireAuth` / `requireApiAuth`.
 */
export async function getCurrentAuth() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.sessionId) {
    return null;
  }

  const activeSession = await prisma.activeSession.findUnique({
    where: { sessionToken: session.sessionId },
  });

  // Session must exist, belong to this user, and be neither revoked nor expired.
  if (
    !activeSession ||
    activeSession.userId !== session.user.id ||
    activeSession.revokedAt ||
    activeSession.expiresAt <= new Date()
  ) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      status: true,
      discipline: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      lastLoginIp: true,
      loginCount: true,
      passwordChangedAt: true,
      deletedAt: true,
      // Presence only — used to decide whether "set a password" UI is needed.
      // The hash itself is never returned to a caller.
      passwordHash: true,
    },
  });

  if (!user || user.deletedAt) return null;

  // Disabled or banned mid-session: drop the session immediately.
  if (user.status !== "ACTIVE") return null;

  // Sliding "last seen" for the admin active-sessions view. Fire-and-forget:
  // this is telemetry and must not fail the request it is attached to.
  void prisma.activeSession
    .update({
      where: { id: activeSession.id },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => {
      /* non-critical */
    });

  const { passwordHash, ...safeUser } = user;

  return {
    session,
    user: { ...safeUser, hasPassword: Boolean(passwordHash) },
    activeSession,
  };
}

export type CurrentAuth = NonNullable<Awaited<ReturnType<typeof getCurrentAuth>>>;

/** Page guard: send unauthenticated visitors to the login screen. */
export async function requireAuth() {
  const auth = await getCurrentAuth();

  if (!auth) {
    redirect("/auth/login");
  }

  return auth;
}

/** Page guard: authenticated *and* holding one of `allowed`. */
export async function requireRole(allowed: readonly UserRole[], fallback = "/dashboard") {
  const auth = await requireAuth();

  if (!hasRole(auth.user.role, allowed)) {
    redirect(fallback);
  }

  return auth;
}
