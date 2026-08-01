import { compare, hash } from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseUserAgent } from "@/lib/device";
import { emitRealtime, toRealtimeLog } from "@/lib/realtime";
import type { LoginEventType, SecurityTokenType } from "@/lib/enums";

const CSRF_COOKIE = "auth_csrf_token";

/** Failed sign-ins are counted over this window before the account locks. */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
/** Per-account attempt budget. */
const LOGIN_LIMIT = 5;
/**
 * Per-IP budget. Higher than the per-account limit on purpose: a whole campus
 * behind one NAT gateway shares an IP, so a strict per-IP limit would lock out
 * innocent students whenever one person fat-fingers their password.
 */
const IP_LOGIN_LIMIT = 20;

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** bcrypt work factor. 12 ≈ 250ms on typical hardware — slow enough to make
 *  offline cracking expensive, fast enough not to stall a sign-in. */
const BCRYPT_ROUNDS = 12;

type HeaderLike = Headers | Record<string, string | string[] | undefined> | undefined | null;

// ---------------------------------------------------------------------------
// Normalisation — the thing that actually prevents duplicate accounts
// ---------------------------------------------------------------------------

/**
 * SQLite string comparison is case-sensitive, so `@@unique` alone would happily
 * allow "Bob@au.edu.ph" and "bob@au.edu.ph" as two separate accounts. Every
 * write path runs the value through here first, which is what makes the unique
 * constraint mean what people expect it to mean.
 */
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Same idea for handles, plus the leading "@" the portal uses. */
export function normalizeUsername(username: string) {
  const trimmed = username.trim().toLowerCase().replace(/\s+/g, "");
  if (!trimmed) return "";
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  return `@${withoutAt}`;
}

// ---------------------------------------------------------------------------
// Tokens and passwords
// ---------------------------------------------------------------------------

export function createRandomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  return hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

/**
 * Burn roughly the same amount of CPU as a real bcrypt comparison.
 *
 * Called when the email does not exist at all. Without it, "no such user"
 * returns in ~1ms while "wrong password" takes ~250ms, and that timing gap is
 * enough to enumerate which email addresses have accounts.
 */
export async function fakePasswordCompare() {
  // A fixed, valid bcrypt hash of a value nothing can match.
  await compare(
    "timing-equalisation",
    "$2a$12$C6UzMDM.H6dfI/f/IKcEe.7Bn5hLMzOaLc0RtcUJQMlKZmQMMwqLu",
  );
}

// ---------------------------------------------------------------------------
// Request metadata
// ---------------------------------------------------------------------------

function readHeader(headers: HeaderLike, key: string) {
  if (!headers) return null;

  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(key);
  }

  const record = headers as Record<string, string | string[] | undefined>;
  const value = record[key] ?? record[key.toLowerCase()] ?? record[key.toUpperCase()];

  if (Array.isArray(value)) return value[0] ?? null;

  return value ?? null;
}

/**
 * Best-effort client IP.
 *
 * `x-forwarded-for` is client-controlled unless a trusted proxy overwrites it,
 * so treat the result as informational for the audit log — never as an
 * authorisation input.
 */
export function getIpFromHeaders(headers: HeaderLike) {
  const forwardedFor = readHeader(headers, "x-forwarded-for");
  const realIp = readHeader(headers, "x-real-ip");
  const cfConnectingIp = readHeader(headers, "cf-connecting-ip");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();

  return cfConnectingIp || realIp || firstForwardedIp || "unknown";
}

export function getUserAgentFromHeaders(headers: HeaderLike) {
  return readHeader(headers, "user-agent") || "Unknown client";
}

// ---------------------------------------------------------------------------
// CSRF
// ---------------------------------------------------------------------------

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  // timingSafeEqual throws on length mismatch, so this guard is required —
  // it also leaks only the length, which is a fixed 43 chars here anyway.
  if (leftBuffer.length !== rightBuffer.length) return false;

  return timingSafeEqual(leftBuffer, rightBuffer);
}

/** Issue a double-submit CSRF token: same value in an httpOnly cookie and body. */
export function createCsrfResponse() {
  const token = createRandomToken();
  const response = NextResponse.json({ token });

  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });

  return response;
}

/** Verify the `x-csrf-token` header matches the cookie set above. */
export function verifyCsrf(request: NextRequest) {
  const csrfHeader = request.headers.get("x-csrf-token");
  const csrfCookie = request.cookies.get(CSRF_COOKIE)?.value;

  return Boolean(csrfHeader && csrfCookie && safeEqual(csrfHeader, csrfCookie));
}

export function csrfError() {
  return NextResponse.json(
    { message: "Security check failed. Refresh the page and try again." },
    { status: 403 },
  );
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

/**
 * Count recent failures for this account and this IP independently.
 *
 * Counting them with a single `OR` (as this previously did) means one attacker
 * hammering an IP also locks out every unrelated account seen from it. Separate
 * budgets keep a brute-force attempt contained to the account it targets.
 */
export async function getLoginRateLimit(email: string, ipAddress: string) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const normalizedEmail = normalizeEmail(email);
  const hasUsableIp = Boolean(ipAddress) && ipAddress !== "unknown";

  const [failedByEmail, failedByIp] = await Promise.all([
    prisma.loginEvent.count({
      where: { type: "LOGIN_FAILED", email: normalizedEmail, createdAt: { gte: since } },
    }),
    hasUsableIp
      ? prisma.loginEvent.count({
          where: { type: "LOGIN_FAILED", ipAddress, createdAt: { gte: since } },
        })
      : Promise.resolve(0),
  ]);

  return {
    limited: failedByEmail >= LOGIN_LIMIT || failedByIp >= IP_LOGIN_LIMIT,
    remaining: Math.max(LOGIN_LIMIT - failedByEmail, 0),
    retryAfterMinutes: Math.ceil(LOGIN_WINDOW_MS / 60000),
  };
}

/** Registrations allowed from one IP address within REGISTER_WINDOW_MS. */
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
/**
 * Deliberately loose. A shared campus NAT gateway puts an entire cohort behind
 * one address, and enrolment week is exactly when a class of forty signs up
 * within the hour — a tight limit would break the one day the feature matters.
 * This stops a script creating thousands of rows, not a queue of real students.
 */
const REGISTER_IP_LIMIT = 40;

/**
 * Throttle public sign-up per IP address.
 *
 * Registration is unauthenticated and writes a row plus two log entries on every
 * call, so without this a single loop can fill the database, flood the admin
 * activity feed until real events are unfindable, and exhaust the disk the
 * SQLite file sits on. The CSRF token is no defence here — anyone can fetch one
 * from `/api/csrf`.
 *
 * Counted from the REGISTER events the sign-up path already writes, so there is
 * no extra table and no in-memory counter to lose on restart (or to disagree
 * with itself across replicas later).
 */
export async function getRegistrationRateLimit(ipAddress: string) {
  // No usable address means no basis to throttle on. Better to allow than to
  // block every genuine visitor behind a proxy that strips the header.
  if (!ipAddress || ipAddress === "unknown") {
    return { limited: false, retryAfterMinutes: 0 };
  }

  const since = new Date(Date.now() - REGISTER_WINDOW_MS);

  const recent = await prisma.loginEvent.count({
    where: { type: "REGISTER", ipAddress, createdAt: { gte: since } },
  });

  return {
    limited: recent >= REGISTER_IP_LIMIT,
    retryAfterMinutes: Math.ceil(REGISTER_WINDOW_MS / 60000),
  };
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

/**
 * Write one row to the activity feed and push it to connected admins.
 *
 * This is the single choke point for requirement 4 — every action that must be
 * logged calls this, so the device/browser/OS enrichment and the live broadcast
 * are guaranteed to happen exactly once and can never be forgotten at a call
 * site.
 *
 * Never throws: a logging failure must not roll back the action being logged.
 */
export async function recordLoginEvent(input: {
  type: LoginEventType;
  success?: boolean;
  userId?: string | null;
  email?: string | null;
  username?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  detail?: string | null;
}) {
  try {
    const { device, browser, os } = parseUserAgent(input.userAgent);

    const event = await prisma.loginEvent.create({
      data: {
        type: input.type,
        success: input.success ?? false,
        userId: input.userId ?? null,
        email: input.email ? normalizeEmail(input.email) : null,
        username: input.username ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        device,
        browser,
        os,
        detail: input.detail ?? null,
      },
    });

    emitRealtime("log:new", toRealtimeLog(event));

    return event;
  } catch (error) {
    console.error("[security] failed to record login event", error);
    return null;
  }
}

/**
 * Recompute the dashboard counters and push them to admins.
 *
 * Call after any change to the user table. Cheap enough to run inline at this
 * scale; if the user count ever grows past tens of thousands, cache it.
 */
export async function broadcastStats() {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalUsers, activeUsers, inactiveUsers, bannedUsers, onlineSessions, registrationsToday] =
      await Promise.all([
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.user.count({ where: { deletedAt: null, status: "ACTIVE" } }),
        prisma.user.count({ where: { deletedAt: null, status: "INACTIVE" } }),
        prisma.user.count({ where: { deletedAt: null, status: "BANNED" } }),
        prisma.activeSession.count({
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
        }),
        prisma.user.count({ where: { deletedAt: null, createdAt: { gte: startOfToday } } }),
      ]);

    emitRealtime("stats:updated", {
      totalUsers,
      activeUsers,
      inactiveUsers,
      bannedUsers,
      onlineSessions,
      registrationsToday,
    });
  } catch (error) {
    console.error("[security] failed to broadcast stats", error);
  }
}

// ---------------------------------------------------------------------------
// Security tokens (email verification / password reset)
// ---------------------------------------------------------------------------

export async function createSecurityToken(input: {
  userId: string;
  type: SecurityTokenType;
  ttlMinutes: number;
}) {
  const token = createRandomToken();
  const now = new Date();

  // Invalidate any outstanding token of the same kind, so a freshly requested
  // reset link silently retires the previous one.
  await prisma.securityToken.deleteMany({
    where: {
      userId: input.userId,
      type: input.type,
      consumedAt: null,
      expiresAt: { gt: now },
    },
  });

  await prisma.securityToken.create({
    data: {
      userId: input.userId,
      type: input.type,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + input.ttlMinutes * 60 * 1000),
    },
  });

  // Only the caller ever sees the plaintext; the DB holds the hash.
  return token;
}

export async function consumeSecurityToken(token: string, type: SecurityTokenType) {
  const tokenHash = hashToken(token);
  const securityToken = await prisma.securityToken.findFirst({
    where: {
      tokenHash,
      type,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!securityToken) return null;

  await prisma.securityToken.update({
    where: { id: securityToken.id },
    data: { consumedAt: new Date() },
  });

  return securityToken.user;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createActiveSession(input: {
  userId: string;
  sessionToken: string;
  rememberMe: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const now = new Date();
  const duration = input.rememberMe ? THIRTY_DAYS_MS : EIGHT_HOURS_MS;
  const expiresAt = new Date(now.getTime() + duration);
  const { device, browser, os } = parseUserAgent(input.userAgent);

  await prisma.activeSession.upsert({
    where: { sessionToken: input.sessionToken },
    create: {
      userId: input.userId,
      sessionToken: input.sessionToken,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      device,
      browser,
      os,
      rememberMe: input.rememberMe,
      expiresAt,
      lastSeenAt: now,
    },
    update: {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      device,
      browser,
      os,
      rememberMe: input.rememberMe,
      expiresAt,
      revokedAt: null,
      lastSeenAt: now,
    },
  });

  return expiresAt;
}

export async function revokeSessionByToken(sessionToken: string, detail = "Session ended") {
  const session = await prisma.activeSession.update({
    where: { sessionToken },
    data: { revokedAt: new Date() },
    include: {
      user: { select: { email: true, username: true } },
    },
  });

  await recordLoginEvent({
    type: "LOGOUT",
    success: true,
    userId: session.userId,
    email: session.user.email,
    username: session.user.username,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    detail,
  });

  return session;
}

/**
 * Revoke every live session for a user.
 *
 * This is what gives "disable account" and "ban" immediate effect — without it
 * a user whose status just changed keeps working until their JWT expires.
 */
export async function revokeAllSessionsForUser(userId: string, detail = "All sessions revoked") {
  const result = await prisma.activeSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (result.count > 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true },
    });

    await recordLoginEvent({
      type: "SESSION_REVOKED",
      success: true,
      userId,
      email: user?.email,
      username: user?.username,
      detail: `${detail} (${result.count} session${result.count === 1 ? "" : "s"})`,
    });
  }

  return result.count;
}
