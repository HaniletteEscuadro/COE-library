import type { DefaultSession } from "next-auth";
import type { AccountStatus, UserRole } from "@/lib/enums";

// Role/status types now come from `src/lib/enums.ts` rather than
// `@prisma/client`: the SQLite connector has no enum support, so those columns
// are plain strings in the schema and the union types live in application code.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      status: AccountStatus;
      emailVerified?: string | null;
      // Carried on the session because the COE portal identifies people by
      // "@username" and scopes almost everything by course. Without these the
      // portal would need a second round-trip on every page load just to learn
      // who it is talking to.
      username?: string | null;
      discipline?: string | null;
    } & DefaultSession["user"];
    sessionId?: string;
    rememberMe?: boolean;
  }

  interface User {
    role?: string;
    status?: string;
    emailVerified?: string | null;
    username?: string | null;
    discipline?: string | null;
    sessionId?: string;
    rememberMe?: boolean;
    ipAddress?: string;
    userAgent?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    status?: string;
    emailVerified?: string | null;
    username?: string | null;
    discipline?: string | null;
    sessionId?: string;
    rememberMe?: boolean;
  }
}
