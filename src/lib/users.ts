/**
 * User service — the single place where user rows are read and mutated.
 *
 * Route handlers stay thin and call into here. Keeping it in one module is what
 * guarantees the three things that must never be forgotten at a call site:
 *
 *   1. the activity log is written,
 *   2. the change is broadcast to connected admins,
 *   3. sessions are revoked when an account stops being allowed to sign in.
 *
 * Nothing here imports from `next/*`, so it is unit-testable on its own and
 * reusable from scripts.
 */

import { prisma } from "@/lib/prisma";
import {
  broadcastStats,
  hashPassword,
  normalizeEmail,
  normalizeUsername,
  recordLoginEvent,
  revokeAllSessionsForUser,
} from "@/lib/security";
import { emitRealtime, toRealtimeUser } from "@/lib/realtime";
import { recordAuditLog } from "@/lib/audit";
import type { AccountStatus, UserRole } from "@/lib/enums";
import type { AdminUserQuery } from "@/lib/validation";

/**
 * Columns returned to admin screens.
 *
 * An explicit `select` rather than a full row: `passwordHash` lives on this
 * model, and a bare `findMany()` would ship every user's hash to the browser.
 */
const ADMIN_USER_SELECT = {
  id: true,
  name: true,
  username: true,
  email: true,
  role: true,
  status: true,
  statusReason: true,
  discipline: true,
  image: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  lastLoginIp: true,
  loginCount: true,
  failedLoginCount: true,
  deletedAt: true,
} as const;

export type AdminUser = Awaited<ReturnType<typeof getUserById>>;

/** Context describing who performed an action and from where. */
export type ActorContext = {
  actorId?: string | null;
  actorName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * A failure the caller can safely show to the user, carrying an HTTP status.
 * Anything else that throws is an unexpected bug and must become a generic 500
 * rather than leaking internals.
 */
export class UserServiceError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly field?: string,
  ) {
    super(message);
    this.name = "UserServiceError";
  }
}

/** Prisma unique-constraint violation. */
function isUniqueViolation(error: unknown): error is { code: "P2002"; meta?: { target?: unknown } } {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

/** Turn a P2002 into a message naming the field the user actually typed. */
function describeUniqueViolation(error: { meta?: { target?: unknown } }) {
  const target = Array.isArray(error.meta?.target)
    ? (error.meta?.target as string[]).join(",")
    : String(error.meta?.target ?? "");

  if (target.includes("username")) {
    return new UserServiceError("That username is already taken.", 409, "username");
  }

  return new UserServiceError("That email address is already registered.", 409, "email");
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Search / filter / sort / paginate for the admin table.
 *
 * Note on case sensitivity: Prisma's `mode: "insensitive"` is a PostgreSQL
 * feature and is not available on SQLite. It is not needed here — `contains`
 * compiles to SQL `LIKE`, which SQLite already treats case-insensitively for
 * ASCII, and `email`/`username` are stored pre-lowercased anyway.
 */
export async function listUsers(query: AdminUserQuery) {
  const { search, role, status, sort, order, page, pageSize, includeDeleted } = query;

  const where = {
    // Soft-deleted rows are hidden unless explicitly requested.
    ...(includeDeleted ? {} : { deletedAt: null }),
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search.toLowerCase() } },
            { username: { contains: search.toLowerCase() } },
            { discipline: { contains: search.toUpperCase() } },
          ],
        }
      : {}),
  };

  // `sort` is constrained by `adminUserQuerySchema` to a whitelist, so this
  // cannot become an arbitrary column name.
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: ADMIN_USER_SELECT,
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Full profile for the admin detail drawer, including recent activity. */
export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      ...ADMIN_USER_SELECT,
      passwordChangedAt: true,
      lockedUntil: true,
      activeSessions: {
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { lastSeenAt: "desc" },
        take: 10,
        select: {
          id: true,
          ipAddress: true,
          device: true,
          browser: true,
          os: true,
          createdAt: true,
          lastSeenAt: true,
          rememberMe: true,
        },
      },
      loginEvents: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          success: true,
          ipAddress: true,
          device: true,
          browser: true,
          os: true,
          detail: true,
          createdAt: true,
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Refuse to remove the last usable administrator.
 *
 * Without this, an admin can demote or delete themselves and permanently lock
 * everyone out of the dashboard — recoverable only by editing the database by
 * hand.
 */
async function assertNotLastAdmin(userId: string, action: string) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (target?.role !== "ADMIN") return;

  const remainingAdmins = await prisma.user.count({
    where: {
      role: "ADMIN",
      status: "ACTIVE",
      deletedAt: null,
      id: { not: userId },
    },
  });

  if (remainingAdmins === 0) {
    throw new UserServiceError(
      `Cannot ${action} the last active administrator. Promote another admin first.`,
      409,
      "role",
    );
  }
}

/** Block an admin from destructive actions against their own account. */
function assertNotSelf(targetId: string, actor: ActorContext, action: string) {
  if (actor.actorId && actor.actorId === targetId) {
    throw new UserServiceError(`You cannot ${action} your own account.`, 409);
  }
}

// ---------------------------------------------------------------------------
// Registration (public)
// ---------------------------------------------------------------------------

/**
 * Create an account from the public signup form.
 *
 * Duplicate prevention is layered: a pre-check for a friendly per-field error,
 * plus a `P2002` catch that is the actual guarantee. The pre-check alone would
 * lose a race between two simultaneous signups for the same email; the unique
 * index in the database is what genuinely prevents it.
 */
export async function registerUser(
  input: {
    name: string;
    username: string;
    email: string;
    password: string;
    discipline?: string;
  },
  meta: { ipAddress?: string | null; userAgent?: string | null } = {},
) {
  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });

  if (existing?.email === email) {
    throw new UserServiceError("That email address is already registered.", 409, "email");
  }

  if (existing?.username === username) {
    throw new UserServiceError("That username is already taken.", 409, "username");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        username,
        email,
        passwordHash,
        discipline: input.discipline || null,
        role: "STUDENT",
        status: "ACTIVE",
        passwordChangedAt: new Date(),
      },
      select: ADMIN_USER_SELECT,
    });

    // --- The live-dashboard hop -------------------------------------------
    // This pair is what makes a new signup appear in every open admin panel
    // with no refresh: the row itself, then the log entry describing it.
    emitRealtime("user:created", toRealtimeUser(user));

    await recordLoginEvent({
      type: "REGISTER",
      success: true,
      userId: user.id,
      email: user.email,
      username: user.username,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      detail: `Account created${input.discipline ? ` (${input.discipline})` : ""}`,
    });

    await recordAuditLog({
      actorId: user.id,
      action: "CREATE",
      entity: "USER",
      entityId: user.id,
      message: `Self-registered account ${user.email}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    void broadcastStats();

    return user;
  } catch (error) {
    if (isUniqueViolation(error)) throw describeUniqueViolation(error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Admin mutations
// ---------------------------------------------------------------------------

/** Create an account directly from the admin panel (pre-verified). */
export async function adminCreateUser(
  input: {
    name: string;
    username: string;
    email: string;
    password: string;
    role: UserRole;
    status: AccountStatus;
    discipline?: string;
  },
  actor: ActorContext,
) {
  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username);
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        username,
        email,
        passwordHash,
        role: input.role,
        status: input.status,
        discipline: input.discipline || null,
        // Admin-created accounts skip verification — an admin vouching for the
        // address is the verification.
        emailVerified: new Date(),
        passwordChangedAt: new Date(),
      },
      select: ADMIN_USER_SELECT,
    });

    emitRealtime("user:created", toRealtimeUser(user));

    await recordLoginEvent({
      type: "REGISTER",
      success: true,
      userId: user.id,
      email: user.email,
      username: user.username,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      detail: `Created by ${actor.actorName ?? "an administrator"}`,
    });

    await recordAuditLog({
      actorId: actor.actorId,
      action: "CREATE",
      entity: "USER",
      entityId: user.id,
      message: `Admin created account ${user.email}`,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      metadata: { role: input.role, status: input.status },
    });

    void broadcastStats();

    return user;
  } catch (error) {
    if (isUniqueViolation(error)) throw describeUniqueViolation(error);
    throw error;
  }
}

/**
 * Edit a user's details.
 *
 * A role change away from ADMIN goes through the last-admin guard, and any
 * change that ends with the account unable to sign in revokes its sessions.
 */
export async function adminUpdateUser(
  id: string,
  changes: {
    name?: string;
    username?: string;
    email?: string;
    discipline?: string;
    role?: UserRole;
    status?: AccountStatus;
    statusReason?: string;
  },
  actor: ActorContext,
) {
  const before = await prisma.user.findUnique({
    where: { id },
    select: ADMIN_USER_SELECT,
  });

  if (!before || before.deletedAt) {
    throw new UserServiceError("That account no longer exists.", 404);
  }

  if (changes.role && changes.role !== before.role) {
    assertNotSelf(id, actor, "change the role of");
    await assertNotLastAdmin(id, "demote");
  }

  if (changes.status && changes.status !== "ACTIVE" && before.status === "ACTIVE") {
    assertNotSelf(id, actor, "disable");
    await assertNotLastAdmin(id, "disable");
  }

  const data: Record<string, unknown> = {};

  if (changes.name !== undefined) data.name = changes.name;
  if (changes.username !== undefined) data.username = normalizeUsername(changes.username);
  if (changes.email !== undefined) data.email = normalizeEmail(changes.email);
  if (changes.discipline !== undefined) data.discipline = changes.discipline || null;
  if (changes.role !== undefined) data.role = changes.role;

  if (changes.status !== undefined) {
    data.status = changes.status;
    data.statusReason = changes.statusReason ?? null;
    data.statusChangedAt = new Date();
    data.statusChangedBy = actor.actorId ?? null;
  }

  // Changing the email invalidates the previous verification.
  if (changes.email !== undefined && normalizeEmail(changes.email) !== before.email) {
    data.emailVerified = null;
  }

  let user;
  try {
    user = await prisma.user.update({
      where: { id },
      data,
      select: ADMIN_USER_SELECT,
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw describeUniqueViolation(error);
    throw error;
  }

  // A disabled or banned account must lose its live sessions immediately,
  // otherwise it keeps working until the JWT expires.
  if (user.status !== "ACTIVE" && before.status === "ACTIVE") {
    await revokeAllSessionsForUser(id, `Account set to ${user.status}`);
  }

  // Describe only what actually changed, for a readable audit trail.
  const changedFields = Object.keys(data).filter(
    (key) => !["statusChangedAt", "statusChangedBy"].includes(key),
  );

  emitRealtime("user:updated", toRealtimeUser(user));

  const statusChanged = changes.status !== undefined && changes.status !== before.status;
  const roleChanged = changes.role !== undefined && changes.role !== before.role;

  await recordLoginEvent({
    type: statusChanged ? "STATUS_CHANGED" : roleChanged ? "ROLE_CHANGED" : "ACCOUNT_UPDATED",
    success: true,
    userId: user.id,
    email: user.email,
    username: user.username,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    detail: statusChanged
      ? `Status ${before.status} to ${user.status}${changes.statusReason ? `: ${changes.statusReason}` : ""}`
      : roleChanged
        ? `Role ${before.role} to ${user.role}`
        : `Updated ${changedFields.join(", ")}`,
  });

  await recordAuditLog({
    actorId: actor.actorId,
    action: statusChanged ? "STATUS_CHANGE" : "UPDATE",
    entity: "USER",
    entityId: user.id,
    message: `Admin updated ${user.email}`,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    metadata: { changedFields, before: { role: before.role, status: before.status } },
  });

  if (statusChanged || roleChanged) void broadcastStats();

  return user;
}

/** Convenience wrapper for the enable / disable / ban buttons. */
export async function setUserStatus(
  id: string,
  status: AccountStatus,
  reason: string | undefined,
  actor: ActorContext,
) {
  return adminUpdateUser(id, { status, statusReason: reason }, actor);
}

/**
 * Delete an account.
 *
 * Soft delete by default: the row is retained so its activity log keeps making
 * sense, and `email`/`username` are released by suffixing them so the address
 * can be registered again later. Pass `hard: true` to remove the row entirely
 * (cascades to sessions and tokens).
 */
export async function deleteUser(id: string, actor: ActorContext, options: { hard?: boolean } = {}) {
  assertNotSelf(id, actor, "delete");
  await assertNotLastAdmin(id, "delete");

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, username: true },
  });

  if (!user) {
    throw new UserServiceError("That account no longer exists.", 404);
  }

  // Kill live sessions before the row goes away.
  await revokeAllSessionsForUser(id, "Account deleted");

  if (options.hard) {
    await prisma.user.delete({ where: { id } });
  } else {
    // Suffix the unique columns so the address/handle become reusable while
    // the historical row is preserved.
    const suffix = `deleted-${Date.now()}`;

    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: "INACTIVE",
        email: user.email ? `${user.email}.${suffix}` : null,
        username: user.username ? `${user.username}.${suffix}` : null,
      },
    });
  }

  emitRealtime("user:deleted", {
    id: user.id,
    username: user.username,
    email: user.email,
  });

  await recordLoginEvent({
    type: "ACCOUNT_DELETED",
    success: true,
    userId: options.hard ? null : user.id,
    email: user.email,
    username: user.username,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    detail: `${options.hard ? "Permanently deleted" : "Deleted"} by ${actor.actorName ?? "an administrator"}`,
  });

  await recordAuditLog({
    actorId: actor.actorId,
    action: "DELETE",
    entity: "USER",
    entityId: user.id,
    message: `Admin deleted ${user.email}`,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    metadata: { hard: Boolean(options.hard) },
  });

  void broadcastStats();

  return { id: user.id };
}

// ---------------------------------------------------------------------------
// Activity log reads
// ---------------------------------------------------------------------------

/** Paginated activity feed for the admin dashboard. */
export async function listLoginEvents(query: {
  search?: string;
  type?: string;
  userId?: string;
  page: number;
  pageSize: number;
}) {
  const where = {
    ...(query.type ? { type: query.type } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.search
      ? {
          OR: [
            { email: { contains: query.search.toLowerCase() } },
            { username: { contains: query.search.toLowerCase() } },
            { ipAddress: { contains: query.search } },
            { detail: { contains: query.search } },
          ],
        }
      : {}),
  };

  const [events, total] = await Promise.all([
    prisma.loginEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        userId: true,
        email: true,
        username: true,
        type: true,
        success: true,
        ipAddress: true,
        device: true,
        browser: true,
        os: true,
        detail: true,
        createdAt: true,
      },
    }),
    prisma.loginEvent.count({ where }),
  ]);

  return {
    events,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/** Counters for the dashboard stat tiles (same shape as the live event). */
export async function getDashboardStats() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalUsers, activeUsers, inactiveUsers, bannedUsers, onlineSessions, registrationsToday] =
    await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, status: "ACTIVE" } }),
      prisma.user.count({ where: { deletedAt: null, status: "INACTIVE" } }),
      prisma.user.count({ where: { deletedAt: null, status: "BANNED" } }),
      prisma.activeSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
      prisma.user.count({ where: { deletedAt: null, createdAt: { gte: startOfToday } } }),
    ]);

  return {
    totalUsers,
    activeUsers,
    inactiveUsers,
    bannedUsers,
    onlineSessions,
    registrationsToday,
  };
}
