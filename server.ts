/**
 * Custom Next.js server with Socket.IO attached.
 *
 * Running Next in-process (rather than `next start` + a separate socket
 * service) is what lets route handlers publish to connected clients: both sides
 * share one Node process, so the in-memory bus in `src/lib/realtime.ts` reaches
 * this file. See the note there before moving to multi-instance hosting.
 *
 * Previously this file imported `./src/lib/chat/{service,rate-limit,validation}`
 * — none of which exist in the repository, so the server could not start at all.
 * The chat feature has no UI or API yet; when it returns, add it as its own
 * namespace rather than re-entangling it with the admin feed.
 */

// Must come first. Next loads `.env` itself, but that happens inside
// `app.prepare()` — by which point the imports below have already run and
// `src/lib/prisma.ts` has read `process.env.DATABASE_URL` at module scope.
import "dotenv/config";

import { createHash } from "crypto";
import { existsSync, statfs } from "fs";
import { createServer } from "http";
import { dirname, join, relative, resolve, isAbsolute } from "path";
import next from "next";
import { getToken } from "next-auth/jwt";
import { Server, type Socket } from "socket.io";
import { prisma } from "./src/lib/prisma";
import {
  ADMIN_ONLY_EVENTS,
  ADMIN_ROOM,
  CHAT_EVENTS,
  LIBRARY_EVENTS,
  LIBRARY_ROOM,
  STAFF_EVENTS,
  STAFF_ROOM,
  USER_EVENTS,
  channelsFor,
  chatRoom,
  onRealtime,
} from "./src/lib/realtime";
import { ACADEMIC_STAFF_ROLES, ADMIN_ROLES, hasRole } from "./src/lib/rbac";

const dev = process.env.NODE_ENV !== "production";

/**
 * SHA-256 of the development `NEXTAUTH_SECRET` that ships in this folder's
 * `.env`, used to refuse it in production.
 *
 * The hash rather than the value: this file is committed, and writing the
 * literal here would publish a secret that is currently signing real sessions
 * on every developer's machine. A hash is enough to recognise it and useless
 * to anyone who does not already have it.
 */
const DEVELOPMENT_SECRET_SHA256 =
  "791dc9a82f39ce366cac5e96fed5f4141502274dc45c096f6a96347b7a176a9f";

function isDevelopmentSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex") === DEVELOPMENT_SECRET_SHA256;
}

/**
 * What address to listen on.
 *
 * In production the socket must be open to every interface: a platform like
 * Railway or Fly runs the app in a container and reaches it from outside, so a
 * server bound to loopback accepts nothing and the deploy fails its health
 * check with no error in the log.
 *
 * `HOSTNAME` is deliberately not used for this. Docker sets it to the container
 * id — a name like "a3f19c2b7e04" that resolves to nothing bindable — and
 * Railway inherits that, so honouring it turns every deploy into a crash loop.
 * It is read only as an explicit override for local use, and only when it looks
 * like an address rather than a container name.
 */
const explicitHost = process.env.HOST || process.env.BIND_HOST || "";
const hostname = explicitHost || (dev ? "127.0.0.1" : "0.0.0.0");

const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

type SocketUser = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  image: string | null;
  role: string;
  status: string;
  discipline: string | null;
};

/**
 * Refuse to start a production server that is misconfigured.
 *
 * Each of these fails silently rather than loudly if it is left unset:
 *
 *   * without NEXTAUTH_SECRET, NextAuth cannot verify the JWTs it issued
 *     before the last restart, so everyone is signed out on every deploy;
 *   * without NEXTAUTH_URL the Socket.IO CORS origin falls back to the bind
 *     address, which in production is 0.0.0.0 and matches no browser — every
 *     live update stops arriving and nothing in the log says why.
 *
 * Better to not boot than to serve a site whose sessions and live updates are
 * quietly broken.
 */
/**
 * Is `target` inside the deployed application directory?
 *
 * That directory is rebuilt from the image on every deploy, so anything written
 * there is temporary no matter how permanent it looks while the container is
 * running.
 */
function isInsideAppDirectory(target: string) {
  const relation = relative(process.cwd(), target);
  return relation !== "" && !relation.startsWith("..") && !isAbsolute(relation);
}

/** Absolute path of a `file:` SQLite URL, or null for a real database server. */
function sqliteFilePath(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) return null;
  // Resolved against the working directory, which is how the better-sqlite3
  // adapter interprets a relative path.
  return resolve(databaseUrl.slice("file:".length));
}

/**
 * Refuse to start a production deploy whose data will not survive it.
 *
 * This is the failure the whole project is most exposed to, and the one nothing
 * else catches. A container's filesystem is rebuilt on every deploy and every
 * restart. If the SQLite file and the uploads directory sit inside the app
 * folder rather than on a mounted volume, then each deploy silently resets the
 * site to an empty database: every account, every uploaded reviewer, every
 * question, gone.
 *
 * Nothing about that looks broken. The site comes up, the health check passes,
 * the login page renders — and users just find their accounts missing. It is
 * discovered days later, by which point the data is unrecoverable because it
 * was never anywhere else.
 *
 * RAILWAY.md has always warned about it in prose. Prose is not a safeguard, so
 * this is the same rule as an actual boot check: a deploy that will not start
 * is recoverable in five minutes, and a deploy that quietly eats the database
 * is not.
 *
 * Set ALLOW_EPHEMERAL_STORAGE=true to deliberately run a throwaway instance —
 * a preview or a demo where losing everything on restart is the intent.
 */
function assertDurableStorage() {
  if (process.env.ALLOW_EPHEMERAL_STORAGE === "true") {
    console.warn(
      "\n  ALLOW_EPHEMERAL_STORAGE=true — the database and uploaded files will\n" +
        "  be DELETED on the next deploy or restart. Never set this on the\n" +
        "  deployment students actually use.\n",
    );
    return;
  }

  const problems: string[] = [];

  const databaseUrl = process.env.DATABASE_URL ?? "";
  const databaseFile = sqliteFilePath(databaseUrl);

  // A hosted Postgres/MySQL URL is durable by definition — only a local file
  // can land on the container's own disk.
  if (databaseFile && isInsideAppDirectory(databaseFile)) {
    problems.push(
      `  DATABASE_URL points inside the app directory:\n` +
        `      ${databaseUrl}  ->  ${databaseFile}\n` +
        `    Every account is erased on the next deploy. Put it on the volume:\n` +
        `      DATABASE_URL=file:/var/data/coe.db   (Railway and Render alike)`,
    );
  }

  /*
   * Does the directory the database is supposed to live in actually exist?
   *
   * The check above proves the path is *outside* the app — which is what makes
   * it survivable — but not that anything is mounted there. Those are different
   * failures and only one of them was caught.
   *
   * The uncaught one looks like this, and it happened on the first real deploy:
   * the volume's mount path was not the one DATABASE_URL named, so `prisma
   * migrate deploy` created /data on the container's own disk, wrote eight
   * migrations into it, and reported success. The container then stopped, the
   * volume was mounted somewhere else, and the next container had no /data at
   * all. The server started fine and every request failed:
   *
   *     prisma:error Cannot open database because the directory does not exist
   *
   * The only visible symptom was a health check timing out, several minutes and
   * one misleading "migrations applied successfully" later.
   *
   * A missing directory here means the volume is not where DATABASE_URL says it
   * is, so refuse to start and say which two values disagree.
   */
  if (databaseFile) {
    const databaseDir = dirname(databaseFile);

    if (!existsSync(databaseDir)) {
      /*
       * Railway names the volume's real mount point in the environment. When it
       * is there, the fix is not a thing to go and look up — it is a value we
       * already hold, so the message states it outright rather than describing
       * where to find it.
       */
      const mounted = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();

      problems.push(
        `  DATABASE_URL points into a directory that does not exist:\n` +
          `      ${databaseUrl}  ->  needs  ${databaseDir}/\n` +
          (mounted
            ? `    The volume attached to this service is mounted at "${mounted}",\n` +
              `    not "${databaseDir}". Either change the volume's Mount Path to\n` +
              `    "${databaseDir}", or set these two variables to match it:\n` +
              `      DATABASE_URL=file:${mounted}/coe.db\n` +
              `      STORAGE_DIR=${mounted}/storage`
            : `    Nothing is mounted there. On Railway this means the volume's\n` +
              `    Mount Path is not "${databaseDir}" — check Settings -> Volumes\n` +
              `    and make the two match.`) +
          `\n    Migrations "succeed" against the container's own disk and are\n` +
          `    then thrown away, so this must fail here instead.`,
      );
    }
  }

  // Mirrors the default in src/lib/storage.ts.
  const storageRoot = resolve(process.env.STORAGE_DIR || join(process.cwd(), "storage"));

  if (isInsideAppDirectory(storageRoot)) {
    problems.push(
      `  STORAGE_DIR ${process.env.STORAGE_DIR ? "points" : "is unset, so uploads go"} ` +
        `inside the app directory:\n` +
        `      ${storageRoot}\n` +
        `    Every uploaded file is erased on the next deploy. Put it on the volume:\n` +
        `      STORAGE_DIR=/var/data/storage   (Railway and Render alike)`,
    );
  } else if (!existsSync(dirname(storageRoot))) {
    /*
     * The same "is anything actually mounted there?" check the database gets,
     * which STORAGE_DIR did not have — and the asymmetry had a specific and
     * nasty failure mode.
     *
     * Set DATABASE_URL correctly and STORAGE_DIR to a path on a volume that is
     * mounted somewhere else, and every check above passes. The server starts,
     * the database is durable, and uploads are written to a directory `mkdir
     * -p` happily creates on the container's own disk. Nothing fails. Then the
     * next deploy replaces the container, and the result is the worst shape
     * this can take: the Material rows survive, so the library still lists
     * every file, and each one 404s when opened. It reads as "the uploads
     * broke" rather than "the uploads were never anywhere durable" — and by
     * then the bytes are gone.
     *
     * The *parent* is checked, not the directory itself: storage/ is created
     * lazily on the first upload, so its absence is normal. Its parent is the
     * volume, and the volume must already be there.
     */
    const mounted = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();

    problems.push(
      `  STORAGE_DIR points into a directory that does not exist:\n` +
        `      ${storageRoot}  ->  needs  ${dirname(storageRoot)}/\n` +
        (mounted
          ? `    The volume attached to this service is mounted at "${mounted}".\n` +
            `    Set:\n` +
            `      STORAGE_DIR=${mounted}/storage`
          : `    Nothing is mounted there, so uploads would be written to the\n` +
            `    container's own disk and thrown away on the next deploy —\n` +
            `    leaving every material in the library pointing at a file that\n` +
            `    no longer exists. Check Settings -> Volumes.`),
    );
  }

  /*
   * Does the ceiling fit the volume?
   *
   * `STORAGE_MAX_BYTES` is what the app refuses to exceed; the volume is what
   * actually exists. Setting the first to 100 GB on a 5 GB volume produces a
   * library that fills up at 5 GB and an error message quoting 100 GB, which
   * sends whoever reads it looking in the wrong place entirely.
   *
   * A warning, not a refusal: the app is perfectly correct in this state, it
   * is only the operator's expectation that is wrong, and refusing to boot
   * over an expectation would be worse than saying so.
   */
  warnIfCapacityExceedsVolume(storageRoot);

  if (problems.length === 0) return;

  console.error(
    `\n  Cannot start: this deployment would lose all of its data.\n\n` +
      `${problems.join("\n\n")}\n\n` +
      `  Attach a volume to the service first, then set the variables above and\n` +
      `  redeploy. See RAILWAY.md.\n\n` +
      `  If this is a throwaway preview and losing everything is intended, set\n` +
      `  ALLOW_EPHEMERAL_STORAGE=true.\n`,
  );
  process.exit(1);
}

/**
 * Compare the configured ceiling against the real free space on the volume.
 *
 * `statfs` is the only way to ask "how big is this filesystem" from Node, and
 * it is not available on every platform — so every failure here is swallowed.
 * This is a courtesy message; it must never be the reason a deploy does not
 * start.
 */
function warnIfCapacityExceedsVolume(storageRoot: string) {
  try {
    const capacity = parseCapacityHere(process.env.STORAGE_MAX_BYTES);
    // The volume, not the directory: storage/ may not exist until the first
    // upload, but the mount point it sits on does.
    const target = existsSync(storageRoot) ? storageRoot : dirname(storageRoot);

    if (!existsSync(target)) return;

    statfs(target, (error, stats) => {
      if (error || !stats) return;

      const volumeBytes = stats.blocks * stats.bsize;
      if (volumeBytes <= 0 || capacity <= volumeBytes) return;

      console.warn(
        `\n  STORAGE_MAX_BYTES is larger than the volume it sits on.\n` +
          `      configured ceiling  ${formatGb(capacity)}\n` +
          `      volume at ${target}  ${formatGb(volumeBytes)}\n` +
          `    Uploads will start failing at ${formatGb(volumeBytes)}, with an error\n` +
          `    quoting the ceiling. Resize the volume in the host's dashboard, or\n` +
          `    lower STORAGE_MAX_BYTES to match what is really there.\n`,
      );
    });
  } catch {
    // Not supported here. The app is unaffected.
  }
}

function formatGb(bytes: number) {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/**
 * A local copy of `parseCapacity` from `src/lib/quota.ts`.
 *
 * Duplicated rather than imported, for the same reason `CHAT_CHANNELS` lives
 * in `realtime.ts` instead of `chat.ts`: quota.ts imports prisma and
 * `lib/users`, and `lib/users` reaches `lib/security` and then `next/server`.
 * Pulling that chain into the custom server crashes it on boot with
 * "AsyncLocalStorage accessed in runtime where it is not available".
 *
 * Nine lines of pure string parsing is a cheaper price than that. If the
 * accepted formats ever change, both copies change — hence this note in each.
 */
function parseCapacityHere(value: string | undefined | null): number {
  const DEFAULT = 100 * 1024 ** 3;
  const raw = String(value ?? "").trim();
  if (!raw) return DEFAULT;

  const match = raw.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/i);
  if (!match) return DEFAULT;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return DEFAULT;

  const unit = (match[2] ?? "b").toLowerCase();
  const multiplier =
    unit === "tb" ? 1024 ** 4 : unit === "gb" ? 1024 ** 3 : unit === "mb" ? 1024 ** 2 : unit === "kb" ? 1024 : 1;

  return Math.floor(amount * multiplier);
}

function assertProductionConfig() {
  if (dev) return;

  const missing = ["NEXTAUTH_SECRET", "NEXTAUTH_URL"].filter(
    (name) => !process.env[name],
  );

  if (missing.length) {
    console.error(
      `\n  Cannot start: ${missing.join(" and ")} ` +
        `${missing.length === 1 ? "is" : "are"} not set.\n` +
        `  Set ${missing.length === 1 ? "it" : "them"} in the deployment's ` +
        `environment variables and redeploy.\n`,
    );
    process.exit(1);
  }

  /*
   * A bare hostname is corrected rather than refused.
   *
   * `NEXTAUTH_URL=coelibrary.up.railway.app` is the single most common way to
   * get this wrong, and it used to stop the deploy dead. But there is nothing
   * ambiguous about it: a value with no scheme is a hostname, and in production
   * the scheme is https. Refusing to start over a missing "https://" is being
   * pedantic about something we can simply resolve.
   *
   * `process.env` is updated in place, before `app.prepare()`, because NextAuth
   * reads the variable itself — correcting only a local copy would leave its
   * callbacks and cookies still pointing at the wrong place, which is the
   * failure this is meant to remove.
   *
   * A value that is malformed in a way we cannot resolve — a scheme we do not
   * understand, or something that is not a URL at all — is still refused below.
   */
  const rawUrl = (process.env.NEXTAUTH_URL ?? "").trim();

  if (rawUrl && !/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl)) {
    const corrected = `https://${rawUrl.replace(/^\/+/, "")}`;
    console.warn(
      `\n  NEXTAUTH_URL had no scheme, so https:// was added:\n` +
        `      ${JSON.stringify(rawUrl)}  ->  ${JSON.stringify(corrected)}\n` +
        `  Set it with the scheme to silence this.\n`,
    );
    process.env.NEXTAUTH_URL = corrected;
  }

  // A trailing slash makes NextAuth build callback URLs with a double slash,
  // which some providers reject. Harmless to strip, confusing to leave.
  if (process.env.NEXTAUTH_URL?.endsWith("/")) {
    process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL.replace(/\/+$/, "");
  }

  if (!/^https?:\/\//.test(process.env.NEXTAUTH_URL ?? "")) {
    console.error(
      `\n  Cannot start: NEXTAUTH_URL must be the full public address, ` +
        `including https:// — got ${JSON.stringify(process.env.NEXTAUTH_URL)}.\n`,
    );
    process.exit(1);
  }

  /*
   * The development secret must never reach production.
   *
   * `.env` is gitignored, but it travels with any copy of this folder — a
   * handed-over zip, a backup, a classmate's laptop. Anyone holding that value
   * can sign a session token the live site will accept, for any account
   * including an administrator's, without ever knowing a password.
   */
  const secret = process.env.NEXTAUTH_SECRET ?? "";

  if (isDevelopmentSecret(secret)) {
    console.error(
      `\n  Cannot start: NEXTAUTH_SECRET is still the development value that\n` +
        `  ships in this folder's .env, so anyone with a copy of the project can\n` +
        `  forge a signed session for any account — administrators included.\n\n` +
        `  Generate a new one and set it in the deployment's variables:\n` +
        `      npm run gen:secret\n`,
    );
    process.exit(1);
  }

  // 32 random bytes is what the generator produces; anything much shorter is
  // either a placeholder or a hand-typed password, and both are guessable.
  if (secret.length < 32) {
    console.error(
      `\n  Cannot start: NEXTAUTH_SECRET is only ${secret.length} characters.\n` +
        `  It signs every session token, so a short one can be brute-forced.\n\n` +
        `  Generate a proper one:\n` +
        `      npm run gen:secret\n`,
    );
    process.exit(1);
  }

  assertDurableStorage();
}

/**
 * Say what is actually in the database, on every boot.
 *
 * "Is my data still there?" should not need a shell, a query tool, or a student
 * reporting that their account vanished. One line in the deploy log answers it:
 *
 *     > data: 14 accounts, 22 materials, 6 announcements at /var/data/coe.db
 *
 * A count that resets to zero after a deploy means the volume is not holding
 * anything, and that is visible immediately rather than a week later. Read it
 * together with the migration output just above: `prisma migrate deploy`
 * printing "No pending migrations to apply" is the other half of the same
 * signal — a database that had to be rebuilt from scratch prints all eight.
 *
 * Never throws. This is diagnostics; a failure here must not stop a server that
 * is otherwise serving perfectly well.
 */
async function reportStoredData() {
  try {
    const databaseFile = sqliteFilePath(process.env.DATABASE_URL ?? "");

    const [accounts, materials, announcements] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.material.count({ where: { deletedAt: null } }),
      prisma.announcement.count({ where: { deletedAt: null } }),
    ]);

    console.log(
      `> data: ${accounts} accounts, ${materials} materials, ` +
        `${announcements} announcements` +
        (databaseFile ? ` at ${databaseFile}` : ""),
    );

    if (accounts === 0) {
      console.log(
        "  (an empty database is expected on a brand-new volume; if it was not\n" +
          "   empty before this deploy, the data is not on the volume)",
      );
    }
  } catch (error) {
    console.warn("> data: could not be counted", error);
  }
}

async function main() {
  assertProductionConfig();

  await app.prepare();

  const httpServer = createServer((request, response) => {
    handler(request, response);
  });

  const io = new Server(httpServer, {
    path: "/api/socket",
    cors: {
      // Same-origin only. A wildcard here would let any site open an
      // authenticated socket using the visitor's cookies.
      origin: process.env.NEXTAUTH_URL || `http://${hostname}:${port}`,
      credentials: true,
    },
    maxHttpBufferSize: 1e6,
  });

  // -------------------------------------------------------------------------
  // Handshake auth
  //
  // Sockets bypass Next's middleware entirely, so this is the *only* thing
  // standing between an anonymous connection and the live admin feed. It
  // re-validates against the database rather than trusting the JWT alone, for
  // the same reason `getCurrentAuth` does.
  // -------------------------------------------------------------------------
  io.use(async (socket, nextMiddleware) => {
    try {
      const token = await getToken({
        req: socket.request as never,
        secret: process.env.NEXTAUTH_SECRET,
      });

      const sessionId =
        typeof token?.sessionId === "string"
          ? token.sessionId
          : typeof socket.handshake.auth?.sessionId === "string"
            ? socket.handshake.auth.sessionId
            : null;

      if (!sessionId) {
        nextMiddleware(new Error("Unauthorized"));
        return;
      }

      const activeSession = await prisma.activeSession.findUnique({
        where: { sessionToken: sessionId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              image: true,
              role: true,
              status: true,
              // Decides which course chat room this socket may join.
              discipline: true,
              deletedAt: true,
            },
          },
        },
      });

      if (
        !activeSession ||
        activeSession.revokedAt ||
        activeSession.expiresAt <= new Date() ||
        !activeSession.user ||
        activeSession.user.deletedAt ||
        activeSession.user.status !== "ACTIVE"
      ) {
        nextMiddleware(new Error("Unauthorized"));
        return;
      }

      const { deletedAt: _deletedAt, ...user } = activeSession.user;

      socket.data.user = user satisfies SocketUser;
      socket.data.sessionId = sessionId;
      nextMiddleware();
    } catch (error) {
      console.error("[socket] handshake failed", error);
      nextMiddleware(error instanceof Error ? error : new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as SocketUser;

    // Personal room, for notifications addressed to this user only.
    socket.join(`user:${user.id}`);

    // The library is a shared drive: every authenticated user sees the same
    // content, so everyone joins.
    socket.join(LIBRARY_ROOM);

    // Room membership is decided here, server-side, from the database role.
    // A client cannot ask to join either of these.
    const isAdmin = hasRole(user.role, ADMIN_ROLES);
    if (isAdmin) {
      socket.join(ADMIN_ROOM);
    }

    // Faculty and registrars see submission activity; students never do.
    const isStaff = hasRole(user.role, ACADEMIC_STAFF_ROLES);
    if (isStaff) {
      socket.join(STAFF_ROOM);
    }

    // Chat rooms, decided here from the database record rather than from
    // anything the client sends — a CE student cannot ask to sit in the EE
    // room by editing a payload.
    const chatChannels = channelsFor({ role: user.role, discipline: user.discipline });
    chatChannels.forEach((channel) => socket.join(chatRoom(channel.slug)));

    socket.emit("socket:ready", {
      userId: user.id,
      role: user.role,
      isAdmin,
      isStaff,
      chatChannels: chatChannels.map((c) => c.slug),
    });

    socket.on("error", (error) => {
      console.error(`[socket] error for user ${user.id}`, error);
    });
  });

  // -------------------------------------------------------------------------
  // Bus -> rooms
  //
  // This is the hop that turns "someone just uploaded a reviewer" inside a
  // route handler into a card appearing in every open library without a
  // refresh.
  //
  // Routing by event class is a security boundary, not a convenience: admin
  // events carry emails, IP addresses and account status, so they must never
  // reach the library room that every student is in.
  // -------------------------------------------------------------------------
  const unsubscribers = [
    // Sensitive — admins only.
    ...ADMIN_ONLY_EVENTS.map((eventName) =>
      onRealtime(eventName, (payload) => {
        io.to(ADMIN_ROOM).emit(eventName, payload);
      }),
    ),

    // Shared content — everyone signed in. Materials, announcements and
    // assignments all land here, which is what makes them appear for every
    // account at the same moment.
    ...LIBRARY_EVENTS.map((eventName) =>
      onRealtime(eventName, (payload) => {
        io.to(LIBRARY_ROOM).emit(eventName, payload);
      }),
    ),

    // Submission activity — staff only.
    ...STAFF_EVENTS.map((eventName) =>
      onRealtime(eventName, (payload) => {
        io.to(STAFF_ROOM).emit(eventName, payload);
      }),
    ),

    // One chat room. Keyed by the payload's own channel, so a message in the
    // EE room reaches only the sockets that were allowed to join it.
    ...CHAT_EVENTS.map((eventName) =>
      onRealtime(eventName, (payload) => {
        const channel = (payload as { channel?: string }).channel;
        if (!channel) return;
        io.to(chatRoom(channel)).emit(eventName, payload);
      }),
    ),

    // Addressed to exactly one user.
    ...USER_EVENTS.map((eventName) =>
      onRealtime(eventName, (payload) => {
        const target = (payload as { userId?: string }).userId;
        if (!target) return;
        io.to(`user:${target}`).emit(eventName, payload);
      }),
    ),
  ];

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO listening on path /api/socket`);
    // Fire-and-forget: diagnostics must never delay or block serving.
    void reportStoredData();
  });

  // Detach bus listeners on shutdown so nodemon/tsx restarts do not stack up
  // duplicate forwarders (which would emit each event N times).
  const shutdown = async (signal: string) => {
    console.log(`\n> ${signal} received, shutting down`);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    io.close();
    httpServer.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("[server] fatal startup error", error);
  process.exit(1);
});
