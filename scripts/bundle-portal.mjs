/**
 * Copy the COE Studio front-end into the deployable app.
 *
 * WHY THIS EXISTS
 * ---------------
 * The portal (index.html, scripts.js, styles.css, ...) lives one level *above*
 * this app, and `src/app/portal/[[...path]]/route.ts` serves it from there.
 * That works locally, where the whole folder is on disk.
 *
 * It does not survive deployment. The repository is initialised inside
 * `auth-system/` (see DEPLOY.md), so a host only ever receives this directory —
 * the parent, and therefore the entire student-facing site, is simply absent
 * and every `/portal/*` request answers 404. The site would look deployed and
 * be empty.
 *
 * So the files are copied in here at build time, committed, and shipped with
 * the app. `npm run build` re-runs this, which is what keeps the copy from
 * drifting: you cannot produce a build from stale portal files.
 *
 * The route still prefers the parent folder when it exists, so local editing is
 * unchanged — edit in place, refresh, see it. The bundled copy is the fallback
 * that only takes over where the parent is not there, i.e. in production.
 *
 * Run directly with `npm run bundle:portal`.
 */

import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(process.env.PORTAL_DIR || join(APP_ROOT, ".."));
const DESTINATION = join(APP_ROOT, "portal");

/**
 * Never copied, for the same reasons the route refuses to serve them: this app's
 * own source and secrets sit inside the portal folder, and a build artefact
 * directory would balloon the image for nothing.
 */
const SKIP_DIRECTORIES = new Set([
  "auth-system",
  "node_modules",
  ".git",
  ".next",
  "storage",
  "_archive_unused",
]);

/**
 * Superseded files, kept on disk for reference but never deployed.
 *
 * `auth.js` was the old sign-in script. It authenticated against a list of
 * accounts in `localStorage`, and its "Microsoft" button fabricated an account
 * and signed the visitor in as it with no password and no server involved.
 * `coe-login.js` replaces it, and login.html no longer loads it — but shipping
 * a file that contains a working fake-login routine, reachable at a public URL,
 * is not something to leave to "nothing links to it".
 *
 * `login-polish.css` only ever styled the old markup.
 *
 * `coe-org.js` filtered the org announcement panels by `course` — the wrong
 * axis, since `course` says who a notice is for, not who published it.
 * `coe-announce.js` replaces it with a real per-org board plus a composer.
 */
const SKIP_FILES = new Set(["auth.js", "login-polish.css", "coe-org.js"]);

/**
 * The same extension allowlist the route serves. Copying anything else would
 * put a file on the server that can never be requested — and a `.env`, `.db` or
 * `.ts` in the portal folder must not be duplicated into the deployment even
 * once, whether or not it is reachable.
 */
const ALLOWED_EXTENSIONS = new Set([
  ".html", ".js", ".mjs", ".css", ".json", ".map", ".svg",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
  ".woff", ".woff2", ".ttf",
  ".mp4", ".webm", ".mp3", ".pdf", ".txt",
]);

let fileCount = 0;
let byteCount = 0;

async function copyTree(from, to) {
  const entries = await readdir(from, { withFileTypes: true });

  for (const entry of entries) {
    // Dotfiles are skipped wholesale — `.env`, `.git`, editor state. The route
    // refuses to serve them too, so copying them could only ever leak.
    if (entry.name.startsWith(".")) continue;

    const source = join(from, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name.toLowerCase())) continue;
      await copyTree(source, join(to, entry.name));
      continue;
    }

    if (!entry.isFile()) continue;
    if (SKIP_FILES.has(entry.name.toLowerCase())) continue;
    if (!ALLOWED_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;

    const target = join(to, entry.name);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target);

    fileCount += 1;
    byteCount += (await stat(source)).size;
  }
}

async function main() {
  try {
    await stat(join(SOURCE, "index.html"));
  } catch {
    // Nothing to bundle. This is the normal case on a host that already has the
    // committed copy: the parent directory is outside the deployment, so there
    // is no source to copy from and the existing `portal/` is already correct.
    // Failing here would break every deploy, so it is a notice, not an error.
    console.log(
      `  portal: no index.html under ${SOURCE} — keeping the committed copy as is.`,
    );
    return;
  }

  // Rebuilt from scratch so a file deleted upstream also disappears here.
  // Without this, a renamed script would leave the old one behind for ever.
  await rm(DESTINATION, { recursive: true, force: true });
  await mkdir(DESTINATION, { recursive: true });

  await copyTree(SOURCE, DESTINATION);

  // Marks the directory as generated, for anyone who finds it and wonders which
  // copy is the real one.
  await writeFile(
    join(DESTINATION, "GENERATED.txt"),
    [
      "Generated by scripts/bundle-portal.mjs — do not edit these files.",
      "",
      `Source: ${SOURCE}`,
      "",
      "Edit the originals in the parent folder and run `npm run build`.",
      "This copy exists so the portal ships with the app; the deployed host",
      "only receives the auth-system directory.",
      "",
    ].join("\n"),
  );

  const megabytes = (byteCount / (1024 * 1024)).toFixed(1);
  console.log(`  portal: bundled ${fileCount} files (${megabytes} MB) into portal/`);
}

main().catch((error) => {
  console.error("[bundle-portal] failed", error);
  process.exit(1);
});
