/**
 * GET /api/health
 *
 * The platform's health check. It has to answer two questions, not one:
 * is the process up, and can it reach its database?
 *
 * A check that only proves the process is listening will happily mark a deploy
 * healthy while every request fails — the container is running, the volume did
 * not mount, and nobody finds out until a student does. Touching the database
 * is what makes the answer worth anything.
 *
 * Unauthenticated by design: a health check runs before any session exists.
 * It returns nothing about the data, only whether the parts are connected.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        database: "reachable",
        ms: Date.now() - started,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[health] database unreachable", error);

    // 503, not 500: this is "not ready to serve", which is what tells the
    // platform to hold traffic back and retry rather than to keep routing.
    return NextResponse.json(
      {
        status: "degraded",
        database: "unreachable",
        ms: Date.now() - started,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
