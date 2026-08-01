import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import {
  broadcastStats,
  createActiveSession,
  createRandomToken,
  fakePasswordCompare,
  getIpFromHeaders,
  getLoginRateLimit,
  getUserAgentFromHeaders,
  normalizeEmail,
  recordLoginEvent,
  verifyPassword,
} from "@/lib/security";
import { loginSchema } from "@/lib/validation";
import { STATUS_SIGN_IN_MESSAGE, type AccountStatus, type UserRole } from "@/lib/enums";

type AuthUserMeta = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  role?: string;
  emailVerified?: string | null;
  sessionId?: string;
  rememberMe?: boolean;
  ipAddress?: string;
  userAgent?: string;
};

export function isGoogleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Whether an unverified email blocks sign-in.
 *
 * Defaults to OFF. Verification links are only generated, not delivered, until
 * SMTP is configured — leaving this on by default meant every freshly created
 * account was locked out with "Verify your email before signing in", which is
 * indistinguishable from a broken login. Set REQUIRE_EMAIL_VERIFICATION="true"
 * once real email delivery is wired up.
 */
function requiresVerifiedEmail() {
  return process.env.REQUIRE_EMAIL_VERIFICATION === "true";
}

/** Generic message for every credential failure — never reveal which part was wrong. */
const INVALID_CREDENTIALS = "Invalid email or password.";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember me", type: "text" },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse({
          email: credentials?.email,
          password: credentials?.password,
          remember: credentials?.remember === "true",
        });

        if (!parsed.success) {
          throw new Error(parsed.error.issues[0]?.message || "Enter valid credentials.");
        }

        const { email, password, remember } = parsed.data;
        const ipAddress = getIpFromHeaders(request?.headers);
        const userAgent = getUserAgentFromHeaders(request?.headers);

        // --- Throttle before touching the password ---------------------------
        const rateLimit = await getLoginRateLimit(email, ipAddress);

        if (rateLimit.limited) {
          await recordLoginEvent({
            type: "LOGIN_FAILED",
            email,
            ipAddress,
            userAgent,
            detail: "Rate limit exceeded",
          });

          throw new Error(
            `Too many failed attempts. Try again in ${rateLimit.retryAfterMinutes} minutes.`,
          );
        }

        // Soft-deleted rows must behave exactly like rows that never existed.
        const user = await prisma.user.findFirst({
          where: { email: normalizeEmail(email), deletedAt: null },
        });

        // --- Credential check ------------------------------------------------
        if (!user?.passwordHash) {
          // Spend the same time as a real bcrypt compare so a missing account
          // is not detectable by response latency.
          await fakePasswordCompare();

          await recordLoginEvent({
            type: "LOGIN_FAILED",
            email,
            ipAddress,
            userAgent,
            detail: "No account or no password set",
          });

          throw new Error(INVALID_CREDENTIALS);
        }

        const passwordIsValid = await verifyPassword(password, user.passwordHash);

        if (!passwordIsValid) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginCount: { increment: 1 } },
          });

          await recordLoginEvent({
            type: "LOGIN_FAILED",
            userId: user.id,
            email,
            username: user.username,
            ipAddress,
            userAgent,
            detail: "Invalid password",
          });

          throw new Error(INVALID_CREDENTIALS);
        }

        // --- Account status --------------------------------------------------
        // Checked only after the password is confirmed, so the disabled/banned
        // state is not disclosed to someone who does not know the password.
        if (user.status !== "ACTIVE") {
          await recordLoginEvent({
            type: "LOGIN_FAILED",
            userId: user.id,
            email,
            username: user.username,
            ipAddress,
            userAgent,
            detail: `Blocked: account is ${user.status}`,
          });

          throw new Error(
            STATUS_SIGN_IN_MESSAGE[user.status as AccountStatus] ??
              "This account cannot sign in. Contact an administrator.",
          );
        }

        if (requiresVerifiedEmail() && !user.emailVerified) {
          await recordLoginEvent({
            type: "LOGIN_FAILED",
            userId: user.id,
            email,
            username: user.username,
            ipAddress,
            userAgent,
            detail: "Email not verified",
          });

          throw new Error("Verify your email before signing in.");
        }

        // --- Success ---------------------------------------------------------
        const sessionId = createRandomToken();

        await createActiveSession({
          userId: user.id,
          sessionToken: sessionId,
          rememberMe: remember,
          ipAddress,
          userAgent,
        });

        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            lastLoginIp: ipAddress,
            failedLoginCount: 0,
            lockedUntil: null,
            loginCount: { increment: 1 },
          },
        });

        await recordLoginEvent({
          type: "LOGIN_SUCCESS",
          success: true,
          userId: user.id,
          email,
          username: user.username,
          ipAddress,
          userAgent,
          detail: remember ? "Credentials login (persistent session)" : "Credentials login",
        });

        // Refresh the admin tiles (online session count just changed).
        void broadcastStats();

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          emailVerified: user.emailVerified?.toISOString() ?? null,
          sessionId,
          rememberMe: remember,
          ipAddress,
          userAgent,
        } satisfies AuthUserMeta;
      },
    }),
    ...(isGoogleAuthConfigured()
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            // Leave off: auto-linking by email lets anyone who can obtain a
            // Google account for an address take over a password account.
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" || !user.email) return true;

      const existing = await prisma.user.findUnique({
        where: { id: user.id },
        select: { status: true, deletedAt: true, username: true },
      });

      // Same gate as the credentials path — a banned user must not slip in
      // through OAuth.
      if (!existing || existing.deletedAt || existing.status !== "ACTIVE") {
        await recordLoginEvent({
          type: "LOGIN_FAILED",
          userId: user.id,
          email: user.email,
          username: existing?.username,
          detail: `Google sign-in blocked: account is ${existing?.status ?? "deleted"}`,
        });

        return false;
      }

      const googleProfile = profile as { email_verified?: boolean } | undefined;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: googleProfile?.email_verified === false ? null : new Date(),
          lastLoginAt: new Date(),
          failedLoginCount: 0,
          loginCount: { increment: 1 },
        },
      });

      return true;
    },

    async jwt({ token, user, account }) {
      // Runs with `user` set only on the initial sign-in.
      if (user) {
        const authUser = user as AuthUserMeta;
        const dbUser = await prisma.user.findUnique({
          where: { id: authUser.id },
          select: {
            role: true,
            emailVerified: true,
            status: true,
            username: true,
            discipline: true,
          },
        });
        const sessionId = authUser.sessionId ?? createRandomToken();
        const rememberMe = authUser.rememberMe ?? account?.provider !== "credentials";

        token.id = authUser.id;
        // Always prefer the database value — never trust a role carried on the
        // token, or an admin demoted mid-session would keep admin access.
        token.role = dbUser?.role ?? authUser.role ?? "USER";
        token.status = dbUser?.status ?? "ACTIVE";
        token.emailVerified = dbUser?.emailVerified?.toISOString() ?? authUser.emailVerified ?? null;
        // Identity fields the COE portal needs on every page.
        token.username = dbUser?.username ?? null;
        token.discipline = dbUser?.discipline ?? null;
        token.sessionId = sessionId;
        token.rememberMe = rememberMe;

        // Credentials sign-in already created its session inside `authorize`;
        // `upsert` makes this idempotent for the OAuth path.
        await createActiveSession({
          userId: authUser.id,
          sessionToken: sessionId,
          rememberMe,
          ipAddress: authUser.ipAddress ?? null,
          userAgent:
            authUser.userAgent ??
            (account?.provider ? `${account.provider} OAuth sign-in` : "Authenticated session"),
        });

        if (account?.provider && account.provider !== "credentials") {
          await recordLoginEvent({
            type: "LOGIN_SUCCESS",
            success: true,
            userId: authUser.id,
            email: authUser.email,
            userAgent: `${account.provider} OAuth sign-in`,
            detail: `${account.provider} OAuth login`,
          });

          void broadcastStats();
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as UserRole) ?? "USER";
        session.user.status = (token.status as AccountStatus) ?? "ACTIVE";
        session.user.emailVerified = (token.emailVerified as string | null) ?? null;
        session.user.username = (token.username as string | null) ?? null;
        session.user.discipline = (token.discipline as string | null) ?? null;
      }

      session.sessionId = token.sessionId as string | undefined;
      session.rememberMe = Boolean(token.rememberMe);

      return session;
    },
  },
};
