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
  } else {
    /*
     * Every bundled file, not just the directory.
     *
     * The check above passes as soon as *something* under portal/ is tracked,
     * which is true from the first commit onwards — so it never fires again,
     * and it does not notice the case that actually happens: a NEW front-end
     * file added to the portal. `npm run build` copies it in, it works
     * perfectly on the developer's machine, and it is left untracked. The push
     * carries every other change and not that file, and the deployed page asks
     * for a script that answers 404 — so the feature it belongs to is simply
     * absent, with nothing in the build log to say why.
     *
     * Listing the missing files by name makes the fix a copyable `git add`.
     */
    const trackedPortal = new Set(tracked.filter((f) => f.startsWith("portal/")));
    const bundled = [];

    const walk = (directory, prefix) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const relative = `${prefix}${entry.name}`;
        if (entry.isDirectory()) walk(join(directory, entry.name), `${relative}/`);
        else if (entry.isFile()) bundled.push(relative);
      }
    };

    walk(join(APP_ROOT, "portal"), "portal/");

    const untracked = bundled.filter((file) => !trackedPortal.has(file));

    if (untracked.length) {
      fail(
        `${untracked.length} bundled portal file(s) are not tracked by git, so they\n` +
          "    would be missing from the deploy:\n" +
          untracked.map((f) => `      ${f}`).join("\n") +
          "\n    Add them:\n" +
          `      git add ${untracked.map((f) => `"${f}"`).join(" ")}`,
      );
    } else {
      notes.push(`all ${bundled.length} bundled portal files are tracked`);
    }
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
  /*
   * `/var/data`, not `/data`.
   *
   * This is the one inconsistency RAILWAY.md opens with: render.yaml, the boot
   * check in server.ts and the deploy guide all say /var/data, and this reminder
   * said /data. Copying it into Railway's variables while the volume is mounted
   * at /var/data is exactly the failure the guide describes — migrations
   * "succeed" against the container's own disk and the data is thrown away on
   * the next deploy. One path everywhere.
   */
  console.log("    DATABASE_URL      file:/var/data/coe.db  (on the mounted volume)");
  console.log("    STORAGE_DIR       /var/data/storage      (on the mounted volume)");
  console.log("    …and the volume's Mount Path must be that same /var/data.\n");
  process.exit(0);
}

console.log("");
for (const problem of problems) {
  console.log(`  FAIL  ${problem}\n`);
}
console.log(`  ${problems.length} problem${problems.length === 1 ? "" : "s"} to fix before pushing.\n`);
process.exit(1);
