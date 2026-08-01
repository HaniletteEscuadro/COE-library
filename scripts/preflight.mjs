/**
 * Pre-push check: would this repository publish something it should not, and is
 * the deployment actually complete?
 *
 *     npm run preflight
 *
 * Every one of these has a failure mode that is invisible until it is too late:
 * a committed database is only noticed once the repository is public, and a
 * missing portal/ is only noticed once students open a blank site. Checking
 * takes a second; finding out later does not.
 *
 * Exits non-zero if anything is wrong, so it can gate a push.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const problems = [];
const notes = [];

function fail(message) {
  problems.push(message);
}

// ---------------------------------------------------------------------------
// 1. Is the portal bundled?
// ---------------------------------------------------------------------------

const portalIndex = join(APP_ROOT, "portal", "index.html");

if (!existsSync(portalIndex)) {
  fail(
    "portal/index.html is missing — the deployed site would 404 for every\n" +
      "    student. Run `npm run build` and commit the portal/ directory.",
  );
} else {
  // Stale copy? The originals are one level up during development.
  const source = join(APP_ROOT, "..", "index.html");

  if (existsSync(source)) {
    const sourceTime = statSync(source).mtimeMs;
    const bundledTime = statSync(portalIndex).mtimeMs;

    if (sourceTime > bundledTime) {
      fail(
        "portal/ is older than the front-end files it was copied from.\n" +
          "    Run `npm run build` so your latest changes actually ship.",
      );
    }
  }

  const count = readdirSync(join(APP_ROOT, "portal")).length;
  notes.push(`portal/ present (${count} entries)`);
}

// ---------------------------------------------------------------------------
// 2. Would git publish a secret or the database?
// ---------------------------------------------------------------------------

let git = true;
try {
  execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: APP_ROOT,
    stdio: "ignore",
  });
} catch {
  git = false;
  notes.push("git not available or not a repository — skipped the tracked-file check");
}

if (git) {
  const tracked = execFileSync("git", ["ls-files"], { cwd: APP_ROOT, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);

  // Anything matching these must never be committed. `.env.example` is the one
  // deliberate exception — it holds names, not values.
  const forbidden = tracked.filter(
    (file) =>
      file !== ".env.example" &&
      (/(^|\/)\.env($|\.)/.test(file) ||
        /\.(db|sqlite|sqlite3)$/.test(file) ||
        /\.db-(journal|wal|shm)$/.test(file) ||
        /(^|\/)backup-/.test(file)),
  );

  if (forbidden.length) {
    fail(
      "these files are tracked by git and must not be:\n" +
        forbidden.map((f) => `      ${f}`).join("\n") +
        "\n    They contain credentials or every account's data. Remove them with\n" +
        "    `git rm --cached <file>` before pushing.",
    );
  } else {
    notes.push(`${tracked.length} files tracked, none of them secrets or databases`);
  }

  if (!tracked.some((f) => f.startsWith("portal/"))) {
    fail("portal/ is not tracked by git — the front-end would not be deployed.");
  }
}

// ---------------------------------------------------------------------------
// 3. Is .env.example still honest?
// ---------------------------------------------------------------------------

const examplePath = join(APP_ROOT, ".env.example");

if (existsSync(examplePath)) {
  const example = readFileSync(examplePath, "utf8");

  // A filled-in value in the example file is a leaked secret waiting to happen.
  const filled = [...example.matchAll(/^(NEXTAUTH_SECRET|SEED_ADMIN_PASSWORD)="(.+)"$/gm)];

  if (filled.length) {
    fail(
      ".env.example contains real values for: " +
        filled.map((m) => m[1]).join(", ") +
        "\n    That file is committed. Blank them out.",
    );
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log("");

for (const note of notes) {
  console.log(`  ok    ${note}`);
}

if (problems.length === 0) {
  console.log("\n  Ready to push.\n");
  console.log("  Remember, in the host's variables — not in a file:");
  console.log("    NEXTAUTH_SECRET   npm run gen:secret");
  console.log("    NEXTAUTH_URL      the real public https:// address");
  console.log("    DATABASE_URL      file:/data/coe.db      (on the mounted volume)");
  console.log("    STORAGE_DIR       /data/storage          (on the mounted volume)\n");
  process.exit(0);
}

console.log("");
for (const problem of problems) {
  console.log(`  FAIL  ${problem}\n`);
}
console.log(`  ${problems.length} problem${problems.length === 1 ? "" : "s"} to fix before pushing.\n`);
process.exit(1);
