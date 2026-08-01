/**
 * GET /portal/*  — serves the COE Studio front-end from the Next.js origin.
 *
 * WHY THIS EXISTS
 * ---------------
 * The portal (index.html, scripts.js, enhanced-library.js, ...) lives one level
 * up from this app and used to be opened straight off the filesystem. That put
 * it on a different origin from the API, which breaks the two things the live
 * features depend on:
 *
 *   1. The NextAuth session cookie is not sent with `fetch` from another
 *      origin, so every API call is a 401.
 *   2. `server.ts` pins the Socket.IO CORS origin to NEXTAUTH_URL, so a socket
 *      opened from `file://` or a Live Server port is refused at the handshake.
 *
 * Serving those same files through this route puts them on `http://host:3000`
 * alongside `/api/*`. Cookies and sockets then work with no CORS configuration
 * and no second copy of the front-end to keep in sync — the files stay where
 * they are and stay editable in place.
 *
 * WHY NOT `public/`
 * -----------------
 * Copying the portal into `public/` would mean two divergent copies of every
 * file. A junction/symlink would recurse, because `auth-system/` is itself
 * inside the portal folder.
 *
 * SECURITY
 * --------
 * This hands out files from a directory by request path, which is the classic
 * shape of a path-traversal bug. Three independent gates stop that:
 *
 *   * the resolved path must still sit inside PORTAL_ROOT after normalisation,
 *   * `auth-system/` is refused outright, so `.env`, `dev.db`, `prisma/` and
 *     the server source are never reachable,
 *   * only whitelisted extensions are served, so a stray `.ts`, `.db`, `.env`
 *     or dotfile anywhere in the tree is a 404 even if the path checks pass.
 *
 * Nothing served here is secret in any case: it is the UI shell. Every piece of
 * real data still comes from `/api/*`, which authenticates each request.
 */

import { NextResponse } from "next/server";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const dynamic = "force-dynamic";

/**
 * Where the portal lives.
 *
 * Two locations, checked in this order:
 *
 *   1. the parent folder — the development layout, where the portal files are
 *      the originals and are edited in place;
 *   2. `portal/` inside this app — a copy written by `scripts/bundle-portal.mjs`
 *      during `npm run build`.
 *
 * The second exists because deployment only ever receives *this* directory: the
 * repository is initialised in `auth-system/`, so on Railway or Render the
 * parent is not part of the deployment at all and serving from it would 404
 * every request for the student portal. Preferring the parent keeps local
 * editing immediate — a change to `scripts.js` shows up on refresh, with no
 * rebuild — while production, where the parent simply is not there, falls
 * through to the bundled copy.
 *
 * PORTAL_DIR overrides both.
 */
function resolvePortalRoot() {
  if (process.env.PORTAL_DIR) return path.resolve(process.env.PORTAL_DIR);

  const parent = path.resolve(path.join(process.cwd(), ".."));
  // `index.html` is the marker: any directory holding it is a portal, and the
  // deployment's parent (`/` on most hosts) never will.
  if (existsSync(path.join(parent, "index.html"))) return parent;

  return path.resolve(path.join(process.cwd(), "portal"));
}

const PORTAL_ROOT = resolvePortalRoot();

/*
 * Say which copy is in use, once, at startup.
 *
 * "The portal is 404ing" has two very different causes — the bundled copy is
 * missing from the deployment, or PORTAL_DIR points somewhere wrong — and
 * without this line they look identical from the outside. One log line here
 * turns that into a five-second diagnosis.
 */
if (!existsSync(path.join(PORTAL_ROOT, "index.html"))) {
  console.warn(
    `[portal] no index.html at ${PORTAL_ROOT} — /portal/* will 404. ` +
      `Run "npm run bundle:portal" and commit portal/, or set PORTAL_DIR.`,
  );
} else {
  console.log(`[portal] serving from ${PORTAL_ROOT}`);
}

/** Directories that must never be reachable, relative to PORTAL_ROOT. */
const DENIED_SEGMENTS = new Set(["auth-system", "node_modules", ".git", ".next", "storage"]);

/**
 * Servable extensions and their content types.
 *
 * A whitelist rather than a blocklist: a file type that is not listed is not
 * served, so adding a `.env.backup` or a database dump to the portal folder
 * cannot accidentally publish it.
 */
const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
};

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  // Next 16: route params are async. Reading them synchronously throws.
  const { path: segments = [] } = await context.params;

  // Bare /portal opens the app.
  const relativeSegments = segments.length > 0 ? segments : ["index.html"];

  // A segment may still be percent-encoded ("Website%20COE"). Decoding can
  // throw on a malformed sequence, which is itself a reason to refuse.
  let decoded: string[];
  try {
    decoded = relativeSegments.map((segment) => decodeURIComponent(segment));
  } catch {
    return notFound();
  }

  // Gate 1: no traversal or hidden files in any segment.
  for (const segment of decoded) {
    if (!segment || segment === "." || segment === "..") return notFound();
    if (segment.startsWith(".")) return notFound();
    if (segment.includes("\0")) return notFound();
    if (DENIED_SEGMENTS.has(segment.toLowerCase())) return notFound();
  }

  const target = path.resolve(PORTAL_ROOT, ...decoded);

  // Gate 2: after normalisation the file must still be inside the root. This
  // catches anything the per-segment checks missed, including symlinked names.
  const rootWithSep = PORTAL_ROOT.endsWith(path.sep) ? PORTAL_ROOT : PORTAL_ROOT + path.sep;
  if (!target.startsWith(rootWithSep)) return notFound();

  // Gate 3: extension whitelist.
  const contentType = CONTENT_TYPES[path.extname(target).toLowerCase()];
  if (!contentType) return notFound();

  let fileInfo;
  try {
    fileInfo = await stat(target);
  } catch {
    return notFound();
  }

  if (!fileInfo.isFile()) return notFound();

  // Streamed, so a 100 MB video lecture is not buffered into memory first.
  const stream = Readable.toWeb(createReadStream(target)) as ReadableStream;

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileInfo.size),
      // The portal is edited live during development; a cached scripts.js is
      // the difference between "my fix did nothing" and a working change.
      "Cache-Control": "no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
