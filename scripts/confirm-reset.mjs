/**
 * Guard in front of `prisma migrate reset --force`.
 *
 * That command drops every table and re-seeds — every account, every uploaded
 * material, every question and every message, with no prompt and no undo. It
 * sat behind `npm run db:reset`, four characters away from `npm run dev` in a
 * shell's history.
 *
 * Wiping the database is a legitimate thing to want; doing it by accident is
 * not. So it now has to be asked for twice: once by name, and once by setting
 * the variable this script checks.
 */

const CONFIRM = "I_UNDERSTAND_THIS_DELETES_EVERYTHING";

if (process.env[CONFIRM] !== "yes") {
  console.error(
    [
      "",
      "  Refusing to reset the database.",
      "",
      "  This deletes EVERY account, material, folder, question and message.",
      "  There is no undo and no backup is taken.",
      "",
      "  If that is really what you want:",
      "",
      "    PowerShell:  $env:" + CONFIRM + ' = "yes"; npm run db:reset',
      "    bash:        " + CONFIRM + "=yes npm run db:reset",
      "",
      "  If you only wanted to apply new migrations, use:",
      "",
      "    npm run setup",
      "",
      "  which never drops anything.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

console.warn(`\n  ${CONFIRM} is set — resetting the database.\n`);
