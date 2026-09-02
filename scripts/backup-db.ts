/**
 * Take one database backup by hand.
 *
 *     npm run db:backup
 *
 * The server takes these on a timer in production. This is the same code, for
 * the moment before you do something risky — a migration, a bulk edit in the
 * admin panel, an upgrade — when waiting for the next scheduled copy is not
 * good enough.
 *
 * Writes to `<STORAGE_DIR>/backups/`, or DB_BACKUP_DIR if set.
 */

import "dotenv/config";
import { backupDatabase, backupDirectory } from "../src/lib/backup";

async function main() {
  const result = await backupDatabase();

  if (!result.ok) {
    console.error(`\n  Backup failed: ${result.reason}\n`);
    process.exit(1);
  }

  const mb = (result.bytes / 1024 / 1024).toFixed(1);

  console.log(`\n  Backed up to ${result.file} (${mb} MB)`);

  if (result.pruned.length) {
    console.log(`  Pruned ${result.pruned.length} older backup(s) from ${backupDirectory()}`);
  }

  console.log(
    `\n  Restore by stopping the app, copying this file over the one at\n` +
      `  DATABASE_URL, and starting again.\n`,
  );
}

main().catch((error) => {
  console.error("\n  Backup failed:", error instanceof Error ? error.message : error, "\n");
  process.exit(1);
});
