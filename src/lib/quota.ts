/**
 * How much the library is allowed to hold, and how much it is holding.
 *
 * WHY THIS EXISTS
 * ---------------
 * Nothing in the app knew how much disk it was using. The only thing that
 * would ever have stopped an upload was the volume filling up, and a full
 * volume does not announce itself — SQLite starts failing writes, uploads
 * half-land, and the first symptom is the site breaking in a way that has
 * nothing obviously to do with storage. A ceiling the app knows about turns
 * that into a sentence a librarian can read.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is not the disk. `STORAGE_MAX_BYTES` is a number this app refuses to
 * exceed; the *actual* space comes from the volume mounted at STORAGE_DIR, and
 * is set in the host's dashboard. Setting this to 100 GB on a 5 GB volume gets
 * you a 5 GB library and a confusing error at the end of it, so the boot check
 * in `server.ts` compares the two and says so.
 *
 * COUNTED FROM THE DATABASE, NOT THE DISK
 * ---------------------------------------
 * Usage is `SUM(sizeBytes)` over the rows, not a walk of the directory tree.
 * At 100 GB a tree walk is thousands of `stat` calls, and this runs on the
 * upload path where it would be the slowest thing in the request. The two can
 * drift — an interrupted write can orphan bytes the database never learned
 * about — so `measureDiskUsage` exists for the admin screen to compare them,
 * and it is deliberately not what enforcement reads.
 */

import { prisma } from "@/lib/prisma";
import { UserServiceError } from "@/lib/users";
import { STORAGE_ROOT } from "@/lib/storage";
import { readdir, stat } from "fs/promises";
import { join } from "path";

const GB = 1024 * 1024 * 1024;

/** Default ceiling. Override with STORAGE_MAX_BYTES. */
export const DEFAULT_STORAGE_CAPACITY_BYTES = 100 * GB;

/**
 * The ceiling, in bytes.
 *
 * Accepts a plain byte count or a human suffix — `100GB`, `250gb`, `512MB` —
 * because this is typed into a hosting dashboard by hand and `107374182400` is
 * a number nobody can check at a glance.
 */
export function parseCapacity(value: string | undefined | null): number {
  const raw = String(value ?? "").trim();
  if (!raw) return DEFAULT_STORAGE_CAPACITY_BYTES;

  const match = raw.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/i);
  if (!match) return DEFAULT_STORAGE_CAPACITY_BYTES;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return DEFAULT_STORAGE_CAPACITY_BYTES;

  const unit = (match[2] ?? "b").toLowerCase();
  const multiplier =
    unit === "tb" ? 1024 ** 4 : unit === "gb" ? 1024 ** 3 : unit === "mb" ? 1024 ** 2 : unit === "kb" ? 1024 : 1;

  return Math.floor(amount * multiplier);
}

export function getStorageCapacityBytes() {
  return parseCapacity(process.env.STORAGE_MAX_BYTES);
}

/**
 * Bytes currently on the volume.
 *
 * SOFT-DELETED ROWS ARE COUNTED, AND THAT IS NOT AN OVERSIGHT
 * ----------------------------------------------------------
 * A soft delete clears the material from the library and leaves its file on
 * disk — a soft delete is meant to be reversible, so the bytes stay. They are
 * therefore still occupying the volume, and a quota that ignored them would
 * report free space that does not exist: the library would say "40 GB used of
 * 100" while the disk was full, and the first symptom would be writes failing
 * for reasons the number on screen flatly contradicts.
 *
 * `deletedAt` is not filtered on here for exactly that reason. What the
 * *library* holds and what the *disk* holds are different questions, and this
 * function answers the second one, because the second one is what runs out.
 *
 * `purgeDeletedMaterials` in library.ts is how the difference is reclaimed.
 *
 * Q&A attachments are counted too. They land in the same volume, and a ceiling
 * that ignored them would be a ceiling the disk does not share.
 */
export async function getStorageUsage() {
  const [materials, liveMaterials, questions, answers] = await Promise.all([
    prisma.material.aggregate({
      where: { storageKey: { not: null } },
      _sum: { sizeBytes: true },
      _count: true,
    }),
    // The same sum for rows still visible in the library, so the difference
    // between the two is the reclaimable amount.
    prisma.material.aggregate({
      where: { storageKey: { not: null }, deletedAt: null },
      _sum: { sizeBytes: true },
    }),
    prisma.question.aggregate({
      where: { attachmentKey: { not: null } },
      _sum: { attachmentSize: true },
      _count: true,
    }),
    prisma.answer.aggregate({
      where: { attachmentKey: { not: null } },
      _sum: { attachmentSize: true },
      _count: true,
    }),
  ]);

  const materialBytes = materials._sum.sizeBytes ?? 0;
  const liveBytes = liveMaterials._sum.sizeBytes ?? 0;
  const attachmentBytes = (questions._sum.attachmentSize ?? 0) + (answers._sum.attachmentSize ?? 0);
  const usedBytes = materialBytes + attachmentBytes;
  const capacityBytes = getStorageCapacityBytes();

  return {
    usedBytes,
    materialBytes,
    attachmentBytes,
    /** Held by materials that were deleted — recoverable by purging them. */
    reclaimableBytes: Math.max(0, materialBytes - liveBytes),
    fileCount: materials._count + questions._count + answers._count,
    capacityBytes,
    freeBytes: Math.max(0, capacityBytes - usedBytes),
    // Rounded to a tenth so the dashboard does not redraw a new number on
    // every byte.
    percentUsed: capacityBytes > 0 ? Math.round((usedBytes / capacityBytes) * 1000) / 10 : 0,
  };
}

/** Human size, matching `formatFileSize` in upload.ts but reaching TB. */
export function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`;
}

/**
 * Refuse an upload that would take the library past its ceiling.
 *
 * Checked before any bytes are written, so a rejected batch leaves nothing
 * behind to clean up. The message says what is left rather than only that
 * something is full — "2.1 GB free" is actionable, "storage full" is not.
 */
export async function assertCapacityFor(incomingBytes: number) {
  const { usedBytes, capacityBytes, freeBytes } = await getStorageUsage();

  if (usedBytes + incomingBytes <= capacityBytes) return;

  throw new UserServiceError(
    `The library is full. It holds ${formatBytes(usedBytes)} of ${formatBytes(capacityBytes)}, ` +
      `so there is ${formatBytes(freeBytes)} free and this upload needs ${formatBytes(incomingBytes)}. ` +
      `Delete some materials, or raise STORAGE_MAX_BYTES once the volume is big enough.`,
    507, // Insufficient Storage — the status that means exactly this.
  );
}

/**
 * What is really on disk, by walking the tree.
 *
 * For the admin screen only. It is O(number of files) in `stat` calls, which
 * is why enforcement reads the database instead — but it is the only way to
 * notice bytes the database does not know about, which is what an interrupted
 * upload leaves behind.
 */
export async function measureDiskUsage(root: string = STORAGE_ROOT) {
  let bytes = 0;
  let files = 0;

  async function walk(directory: string) {
    let entries;

    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      // The directory may not exist yet — nothing has been uploaded. That is
      // zero bytes, not an error.
      return;
    }

    for (const entry of entries) {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }

      if (!entry.isFile()) continue;

      try {
        bytes += (await stat(path)).size;
        files += 1;
      } catch {
        // Raced with a delete. Skip it.
      }
    }
  }

  await walk(root);

  return { bytes, files };
}
