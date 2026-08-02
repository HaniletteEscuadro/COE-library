/**
 * GET  /api/library/storage — how full the library is
 * POST /api/library/storage — purge deleted materials and reclaim their space
 *
 * The GET is open to any signed-in account: how full the shared library is, is
 * shared information, and a student who cannot upload still benefits from
 * knowing why an upload was refused. The disk-versus-database comparison and
 * the purge are administrators only — the first is diagnostic detail nobody
 * else can act on, the second permanently destroys files.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { verifyCsrf, csrfError, getIpFromHeaders, getUserAgentFromHeaders } from "@/lib/security";
import { getStorageUsage, measureDiskUsage, formatBytes } from "@/lib/quota";
import { purgeDeletedMaterials, canModerate } from "@/lib/library";
import { UserServiceError } from "@/lib/users";
import { z } from "zod";

export const dynamic = "force-dynamic";

const purgeSchema = z.object({
  /*
   * The grace period, in days.
   *
   * `min(1)` on purpose: a zero would purge something deleted a second ago,
   * which removes the "I deleted the wrong one" window entirely. If somebody
   * genuinely wants that, they can hard-delete the material itself.
   */
  olderThanDays: z.coerce.number().int().min(1).max(3650).default(30),
});

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  try {
    const usage = await getStorageUsage();
    const moderator = canModerate(auth.user.role);

    /*
     * The real disk figure is administrator-only and opt-in.
     *
     * It walks the whole tree, which at 100 GB is thousands of stat calls —
     * not something to run on every dashboard render. `?disk=true` is how the
     * admin asks for it when they actually want the comparison.
     */
    const wantsDisk = moderator && request.nextUrl.searchParams.get("disk") === "true";
    const disk = wantsDisk ? await measureDiskUsage() : null;

    return NextResponse.json({
      ...usage,
      // Pre-formatted so every screen shows the same units rather than each
      // reinventing the rounding.
      usedLabel: formatBytes(usage.usedBytes),
      capacityLabel: formatBytes(usage.capacityBytes),
      freeLabel: formatBytes(usage.freeBytes),
      reclaimableLabel: formatBytes(usage.reclaimableBytes),
      canPurge: moderator,
      ...(disk
        ? {
            diskBytes: disk.bytes,
            diskFiles: disk.files,
            diskLabel: formatBytes(disk.bytes),
            // Bytes on the volume that no row accounts for — what an
            // interrupted upload leaves behind.
            orphanBytes: Math.max(0, disk.bytes - usage.usedBytes),
            orphanLabel: formatBytes(Math.max(0, disk.bytes - usage.usedBytes)),
          }
        : {}),
    });
  } catch (error) {
    console.error("[api/library/storage] GET", error);
    return NextResponse.json({ message: "Could not read storage usage." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = purgeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Check the purge settings." },
      { status: 400 },
    );
  }

  try {
    const result = await purgeDeletedMaterials(parsed.data.olderThanDays, {
      actorId: auth.user.id,
      actorName: auth.user.name ?? auth.user.username,
      role: auth.user.role,
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    });

    return NextResponse.json({
      message: result.purged
        ? `Purged ${result.purged} material${result.purged === 1 ? "" : "s"}, freeing ${formatBytes(result.bytes)}.`
        : "Nothing old enough to purge.",
      ...result,
      freedLabel: formatBytes(result.bytes),
      usage: await getStorageUsage(),
    });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/library/storage] POST", error);
    return NextResponse.json({ message: "Could not purge." }, { status: 500 });
  }
}
