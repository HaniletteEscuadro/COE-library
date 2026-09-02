/**
 * Scheduled backups of the SQLite database.
 *
 * The volume checks in `server.ts` stop the one failure that erases every
 * account at once (an unmounted volume). They do nothing about the slower ones:
 * a mistaken hard-delete in the admin panel, a migration that drops the wrong
 * column, a corrupted page after an unclean shutdown. Those leave the volume
 * perfectly intact and the data still gone.
 *
 * So: a copy of the database, taken on a timer, kept next to the uploads on the
 * same volume. Same-volume backups do not survive losing the volume — nothing
 * written by this process can — but they turn "the accounts are gone" into
 * "restore yesterday's file", which is the difference that matters day to day.
 *
 * `Database.backup()` is SQLite's online backup API, not a file copy: it reads
 * through the same connection layer, so a write landing mid-backup produces a
 * consistent destination file rather than a torn one. A plain `fs.copyFile` of
 * a live database can silently produce an unopenable file.
 *
 * Off by default in development — the timer only starts when `server.ts` calls
 * `startDatabaseBackups()` in production, or when `npm run db:backup` runs one
 * by hand.
 */

import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/** Files this module writes, so retention never deletes anything else. */
const BACKUP_PREFIX = "coe-";
const BACKUP_SUFFIX = ".db";

function envInt(name: string, fallback: number) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

/**
 * Absolute path of the live SQLite file, or null when the database is a real
 * server (Postgres/MySQL) — which has its own backup story and is not ours.
 */
export function sqliteDatabaseFile() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) return null;
  // Relative paths resolve against the working directory, which is how the
  // better-sqlite3 driver adapter interprets them.
  return resolve(url.slice("file:".length));
}

/**
 * Where copies are written. Defaults to `<STORAGE_DIR>/backups`, so pointing
 * STORAGE_DIR at the mounted volume puts the backups there too — the same
 * variable already has to be set correctly for uploads to survive.
 */
export function backupDirectory() {
  if (process.env.DB_BACKUP_DIR) return resolve(process.env.DB_BACKUP_DIR);
  const storageRoot = resolve(process.env.STORAGE_DIR || join(process.cwd(), "storage"));
  return join(storageRoot, "backups");
}

/** `coe-2026-09-02T040012.db` — sorts chronologically as plain text. */
function backupName(now: Date) {
  const stamp = now.toISOString().slice(0, 19).replace(/:/g, "");
  return `${BACKUP_PREFIX}${stamp}${BACKUP_SUFFIX}`;
}

/**
 * Delete the oldest copies until `keep` remain.
 *
 * Without this the volume fills up, and a full volume fails *writes* — which
 * means new accounts stop being created, the exact outcome the backups exist to
 * prevent. Only files this module named are considered.
 */
async function pruneBackups(directory: string, keep: number) {
  const entries = (await readdir(directory)).filter(
    (name) => name.startsWith(BACKUP_PREFIX) && name.endsWith(BACKUP_SUFFIX),
  );

  if (entries.length <= keep) return [];

  // Newest first by name, which is chronological because of the timestamp.
  entries.sort().reverse();
  const doomed = entries.slice(keep);

  for (const name of doomed) {
    await rm(join(directory, name), { force: true });
  }

  return doomed;
}

export type BackupResult =
  | { ok: true; file: string; bytes: number; pruned: string[] }
  | { ok: false; reason: string };

/**
 * Take one backup now.
 *
 * Never throws: a failed backup must not take the site down with it. The caller
 * logs the reason and the site keeps serving.
 */
export async function backupDatabase(): Promise<BackupResult> {
  const source = sqliteDatabaseFile();

  if (!source) {
    return { ok: false, reason: "DATABASE_URL is not a SQLite file — nothing to copy." };
  }

  if (!existsSync(source)) {
    return { ok: false, reason: `database file does not exist: ${source}` };
  }

  const directory = backupDirectory();
  const destination = join(directory, backupName(new Date()));

  let db: InstanceType<typeof Database> | null = null;

  try {
    await mkdir(directory, { recursive: true });

    // Already taken this minute (two boots in quick succession). Not a failure.
    if (existsSync(destination)) {
      return { ok: false, reason: `backup already exists: ${destination}` };
    }

    // Read-only: this connection must never be able to write to the live file.
    db = new Database(source, { readonly: true, fileMustExist: true });
    await db.backup(destination);

    const { size } = await stat(destination);
    const pruned = await pruneBackups(directory, envInt("DB_BACKUP_KEEP", 14));

    return { ok: true, file: destination, bytes: size, pruned };
  } catch (error) {
    // A half-written destination is worse than none: it looks like a restore
    // point and is not one.
    await rm(destination, { force: true }).catch(() => {});
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  } finally {
    db?.close();
  }
}

/**
 * Start the backup timer: one immediately, then every
 * `DB_BACKUP_INTERVAL_HOURS` (default 24).
 *
 * The first one runs at boot rather than a day later, so a deploy always leaves
 * behind a copy of the state it started from — the thing you want when a
 * migration in that same deploy turns out to be wrong.
 *
 * Returns a stop function for shutdown. `unref()` keeps the timer from holding
 * the process open.
 */
export function startDatabaseBackups() {
  if (process.env.DB_BACKUP_DISABLED === "true") {
    console.warn("  DB_BACKUP_DISABLED=true — no database backups will be taken.");
    return () => {};
  }

  if (!sqliteDatabaseFile()) return () => {};

  const hours = envInt("DB_BACKUP_INTERVAL_HOURS", 24);

  const run = async () => {
    const result = await backupDatabase();

    if (result.ok) {
      const mb = (result.bytes / 1024 / 1024).toFixed(1);
      console.log(
        `> backup: ${result.file} (${mb} MB)` +
          (result.pruned.length ? `, pruned ${result.pruned.length} old` : ""),
      );
    } else {
      // Warn, never throw. A missed backup is a problem to fix; a crashed
      // server is an outage.
      console.warn(`> backup skipped: ${result.reason}`);
    }
  };

  void run();

  const timer = setInterval(() => void run(), hours * 60 * 60 * 1000);
  timer.unref();

  console.log(`> database backups every ${hours}h -> ${backupDirectory()}`);

  return () => clearInterval(timer);
}

/** Directory holding the live database, for callers that need it. */
export function databaseDirectory() {
  const file = sqliteDatabaseFile();
  return file ? dirname(file) : null;
}
