import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

/**
 * Shared Prisma client.
 *
 * Cached on `globalThis` because Next's dev server re-evaluates modules on every
 * hot reload; without this, each reload opens a new connection and the process
 * eventually runs out of handles.
 *
 * Prisma 7 requires a driver adapter and no longer accepts `url` in the
 * `datasource` block, so the connection string is passed here instead. The
 * Postgres adapter was swapped for the SQLite one when the datasource moved.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env — see SETUP.md.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
