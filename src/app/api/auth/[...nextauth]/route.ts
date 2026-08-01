/**
 * NextAuth catch-all handler.
 *
 * Without this file nothing can sign in at all — every NextAuth endpoint
 * (`/api/auth/signin`, `/callback`, `/session`, `/csrf`, `/signout`) is served
 * from here. The configuration itself lives in `src/lib/auth.ts`.
 *
 * The same handler is exported for GET and POST because NextAuth routes both:
 * GET for session/provider lookups, POST for the actual credential exchange.
 */

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
