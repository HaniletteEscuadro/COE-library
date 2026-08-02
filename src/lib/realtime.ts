/**
 * In-process event bus bridging application code to the Socket.IO server.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Socket.IO server is created in `server.ts`. Route handlers and server
 * actions live inside the Next.js app. Importing the `io` instance directly
 * into a route handler would drag the whole server bootstrap into the Next
 * bundle, so instead both sides talk to this tiny emitter:
 *
 *     route handler  --emit-->  [ bus ]  --on-->  server.ts  --> io.to("admin")
 *
 * This works because `server.ts` runs Next in-process (`next({ dev })`), so
 * there is exactly one Node process and therefore one shared module instance.
 *
 * IMPORTANT: if you ever switch to `next start` (no custom server), or scale to
 * more than one process/instance, an in-memory emitter no longer reaches every
 * client. At that point swap the transport here for Redis pub/sub — the emit
 * call sites elsewhere in the app do not need to change.
 */

import { EventEmitter } from "events";

// ---------------------------------------------------------------------------
// Event payloads
// ---------------------------------------------------------------------------

/** Shape of a user row as broadcast to the admin dashboard. */
export type RealtimeUser = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  role: string;
  status: string;
  discipline: string | null;
  image: string | null;
  emailVerified: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  loginCount: number;
};

/** Shape of an activity-log row as broadcast to the admin dashboard. */
export type RealtimeLog = {
  id: string;
  userId: string | null;
  username: string | null;
  email: string | null;
  type: string;
  success: boolean;
  ipAddress: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  detail: string | null;
  createdAt: string;
};

/** Live counters for the dashboard stat tiles. */
export type RealtimeStats = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  bannedUsers: number;
  onlineSessions: number;
  registrationsToday: number;
};

/** A material as broadcast to the library grid. */
export type RealtimeMaterial = {
  id: string;
  folderId: string;
  folderPath: string;
  title: string;
  /**
   * The filename as uploaded.
   *
   * Carried because the library list falls back to it when a material's title
   * is only its folder read back — which is what every upload made from a
   * folder used to be called, leaving a folder of files that all showed the
   * same name.
   */
  originalName: string;
  description: string | null;
  kind: string;
  mimeType: string;
  extension: string | null;
  sizeBytes: number;
  thumbnailKey: string | null;
  externalUrl: string | null;
  course: string | null;
  year: string | null;
  /** The lesson this material belongs to — the column students navigate by. */
  semester: string | null;
  subject: string | null;
  department: string | null;
  professor: string | null;
  tags: string[];
  status: string;
  pinned: boolean;
  viewCount: number;
  downloadCount: number;
  likeCount: number;
  commentCount: number;
  ratingAverage: number;
  uploadedById: string | null;
  uploadedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Live folder counter update. */
export type RealtimeFolderCount = {
  folderId: string;
  materialCount: number;
  /** Ancestor ids whose rolled-up totals also changed. */
  ancestorIds: string[];
};

/** Library-wide counters for the dashboard tiles. */
export type RealtimeLibraryStats = {
  totalMaterials: number;
  pdfs: number;
  videos: number;
  handouts: number;
  references: number;
  totalDownloads: number;
  totalViews: number;
  pendingApprovals: number;
  /**
   * How full the library is.
   *
   * Broadcast with the rest so the usage tile moves the moment somebody
   * uploads, rather than at the next page load — a storage figure that is
   * stale is a storage figure nobody trusts.
   */
  storageUsedBytes: number;
  storageCapacityBytes: number;
  storageFreeBytes: number;
  storagePercentUsed: number;
};

/** An announcement as broadcast to the board. */
export type RealtimeAnnouncement = {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  course: string | null;
  year: string | null;
  /** Publishing body: "COESC" | "PICE" | "IIEE", or null for college-wide. */
  org: string | null;
  pinned: boolean;
  authorId: string | null;
  authorName: string | null;
  publishedAt: string;
  expiresAt: string | null;
  /** The day the notice is about, "YYYY-MM-DD" — not when it expires. */
  eventDate: string | null;
};

/** An assignment as broadcast to the class. */
export type RealtimeAssignment = {
  id: string;
  title: string;
  description: string | null;
  course: string | null;
  year: string | null;
  subject: string | null;
  status: string;
  dueAt: string | null;
  points: number;
  submissionCount: number;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
};

/**
 * A submission, for the staff feed only.
 *
 * Deliberately carries no answer content — only who submitted and when. The
 * actual work is fetched through an authorised route, so a stray broadcast can
 * never leak one student's answers to another.
 */
export type RealtimeSubmission = {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  studentId: string;
  studentName: string | null;
  status: string;
  isLate: boolean;
  score: number | null;
  submittedAt: string;
};

/** A question as broadcast to the Q&A board. */
export type RealtimeQuestion = {
  id: string;
  title: string;
  description: string;
  course: string;
  yearLevel: string;
  subject: string;
  lesson: string;
  tags: string[];
  status: string;
  /** ReviewStatus — PENDING | APPROVED | REJECTED. Publication, not answering. */
  reviewStatus: string;
  askerId: string | null;
  askerName: string;
  bestAnswerId: string | null;
  answerCount: number;
  viewCount: number;
  /**
   * The attached photo or file.
   *
   * A name and a type, never the storage key: the key is the on-disk location
   * and a client that held one could ask for any file in the store. The bytes
   * come from `/api/qa/attachment/...`, which resolves the key server-side
   * after checking that this account may see the question.
   */
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentSize: number;
  createdAt: string;
  updatedAt: string;
};

/** An answer as broadcast to the Q&A board. */
export type RealtimeAnswer = {
  id: string;
  questionId: string;
  text: string;
  answererId: string | null;
  answererName: string;
  verified: boolean;
  /** PENDING | APPROVED | REJECTED — whether anyone but the author may read it. */
  reviewStatus: string;
  voteCount: number;
  commentCount: number;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentSize: number;
  createdAt: string;
};

/** A comment on an answer. */
export type RealtimeAnswerComment = {
  id: string;
  answerId: string;
  questionId: string;
  text: string;
  commenterId: string | null;
  commenterName: string;
  createdAt: string;
};

/** A chat message as broadcast to its room. */
export type RealtimeChatMessage = {
  id: string;
  /** "general" | "ce" | "ee" — decides which room this goes to. */
  channel: string;
  body: string;
  type: string;
  senderId: string | null;
  senderName: string;
  senderUsername: string;
  senderRole: string;
  senderImage: string | null;
  createdAt: string;
  editedAt: string | null;
};

/** A notification pushed to one specific user. */
export type RealtimeNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  actorName: string | null;
  createdAt: string;
};

/** A council seat as broadcast to every signed-in user. */
export type RealtimeCouncilOfficer = {
  id: string;
  position: string;
  positionLabel: string;
  name: string;
  course: string;
  hasPhoto: boolean;
  /** Versioned, so a replaced photo is not served from the browser cache. */
  photoUrl: string | null;
  sortOrder: number;
};

/**
 * A committee application, for the staff feed only.
 *
 * Deliberately carries no `message` and no contact details: the card in the
 * reviewer's queue only needs to say that something arrived, and the full row
 * is fetched through an authorised route.
 */
export type RealtimeApplication = {
  id: string;
  committee: string;
  committeeName: string;
  fullName: string;
  course: string;
  yearLevel: string;
  status: string;
  createdAt: string;
};

/**
 * Every event a client can receive. Keeping this as a typed map means
 * `emitRealtime` and the `server.ts` listener cannot drift apart — a renamed
 * event or changed payload is a compile error on both sides.
 */
export type RealtimeEvents = {
  // --- Admin dashboard (admin room only) ---
  "user:created": RealtimeUser;
  "user:updated": RealtimeUser;
  "user:deleted": { id: string; username: string | null; email: string | null };
  "log:new": RealtimeLog;
  "stats:updated": RealtimeStats;

  // --- Shared library (every signed-in user) ---
  "material:created": RealtimeMaterial;
  "material:updated": RealtimeMaterial;
  "material:deleted": { id: string; folderId: string; title: string };
  "material:counts": {
    id: string;
    viewCount: number;
    downloadCount: number;
    likeCount: number;
    commentCount: number;
    ratingAverage: number;
  };
  "folder:counts": RealtimeFolderCount;
  "folder:changed": { id: string; parentId: string | null; name: string; path: string } | null;
  "library:stats": RealtimeLibraryStats;

  // --- Announcements (every signed-in user) ---
  "announcement:created": RealtimeAnnouncement;
  "announcement:updated": RealtimeAnnouncement;
  "announcement:deleted": { id: string; title: string };

  // --- Assignments and submissions ---
  /** New task posted — the whole class needs to see it. */
  "assignment:created": RealtimeAssignment;
  "assignment:updated": RealtimeAssignment;
  "assignment:deleted": { id: string; title: string };
  /**
   * A submission arrived. Broadcast to staff only: a student must not see
   * who else has submitted, or what they submitted.
   */
  "submission:created": RealtimeSubmission;
  "submission:updated": RealtimeSubmission;

  // --- Q&A hub (every signed-in user) ---
  //
  // The board is shared, so these go to the same room as the library. This is
  // what makes an answer — and the answer count on the card — appear on
  // everyone's screen rather than only the browser that posted it.
  "question:created": RealtimeQuestion;
  "question:updated": RealtimeQuestion;
  "question:deleted": { id: string; title: string };
  "answer:created": RealtimeAnswer;
  "answer:updated": RealtimeAnswer;
  "answer:deleted": { id: string; questionId: string };
  "answer:comment": RealtimeAnswerComment;

  // --- Live chat ---
  //
  // Routed per channel, not to the shared room: a CE student must not receive
  // the EE room's traffic just because they are signed in. `payload.channel`
  // decides which room it lands in.
  "chat:message": RealtimeChatMessage;
  "chat:deleted": { id: string; channel: string };

  // --- COESC ---
  //
  // The roster is public inside the college, so an edit goes to everyone: a
  // photo uploaded by an administrator appears on every open COESC tab without
  // a refresh, which is the same promise the library makes.
  "coesc:officer-updated": RealtimeCouncilOfficer;
  /**
   * A committee application arrived. Staff room only — it names a student and
   * carries what they wrote, which is not for the whole college.
   */
  "coesc:application-created": RealtimeApplication;
  /** A decision was made. Staff room; the applicant is told by notification. */
  "coesc:application-updated": {
    id: string;
    committee: string;
    status: string;
    applicantId: string;
  };

  // --- Student Voice ---
  //
  // The asymmetry here is the feature, not an oversight.
  //
  // `concern:created` names the student who raised it, so it is admin-room
  // only — it is what puts a new submission in every administrator's queue
  // without a refresh.
  //
  // `concern:updated` and `concern:deleted` carry an id and a status and
  // nothing else, deliberately, so they can go to every signed-in account.
  // Clients treat them as a signal to refetch, and the refetch applies the
  // public/administrator split again on the server. No payload means no leak.
  "concern:created": {
    id: string;
    category: string;
    title: string;
    status: string;
    authorName: string;
    createdAt: string;
  };
  "concern:updated": { id: string; status: string };
  "concern:deleted": { id: string };

  // --- Per-user ---
  "notification:new": RealtimeNotification;
};

export type RealtimeEventName = keyof RealtimeEvents;

/**
 * Events restricted to the admin room. Everything else in `RealtimeEvents` is
 * library content that every signed-in user is allowed to see — this list is
 * the security boundary, so adding an event here is how you keep it private.
 */
export const ADMIN_ONLY_EVENTS = [
  "user:created",
  "user:updated",
  "user:deleted",
  "log:new",
  "stats:updated",
  // Names the student who raised the concern. This one line is what keeps the
  // Student Voice board anonymous while its queue is not.
  "concern:created",
] as const satisfies readonly RealtimeEventName[];

/**
 * Broadcast to every signed-in user (the shared-library room).
 *
 * Announcements and assignments belong here: the whole point is that everyone
 * sees them at the same moment.
 */
export const LIBRARY_EVENTS = [
  "material:created",
  "material:updated",
  "material:deleted",
  "material:counts",
  "folder:counts",
  "folder:changed",
  "library:stats",
  "announcement:created",
  "announcement:updated",
  "announcement:deleted",
  "assignment:created",
  "assignment:updated",
  "assignment:deleted",
  // The Q&A board is public to signed-in users, exactly like the library.
  "question:created",
  "question:updated",
  "question:deleted",
  "answer:created",
  "answer:updated",
  "answer:deleted",
  "answer:comment",
  // The council roster is public information inside the college, exactly like
  // the library. Its applications are not, and are in STAFF_EVENTS instead.
  "coesc:officer-updated",
  // Safe here only because their payloads are an id and a status. If either
  // ever needs to carry the concern's author, it moves to ADMIN_ONLY_EVENTS.
  "concern:updated",
  "concern:deleted",
] as const satisfies readonly RealtimeEventName[];

/**
 * Staff-only. Submissions identify which student handed in what and when —
 * broadcasting that to the shared room would expose one student's activity to
 * the entire class.
 */
export const STAFF_EVENTS = [
  "submission:created",
  "submission:updated",
  // Committee applications name the student who sent them.
  "coesc:application-created",
  "coesc:application-updated",
] as const satisfies readonly RealtimeEventName[];

/** Routed to a single user's personal room, keyed by `payload.userId`. */
export const USER_EVENTS = ["notification:new"] as const satisfies readonly RealtimeEventName[];

/**
 * Routed to one chat room, keyed by `payload.channel`.
 *
 * Its own class rather than part of LIBRARY_EVENTS: those go to every signed-in
 * account, and the two course rooms are not for every account.
 */
export const CHAT_EVENTS = [
  "chat:message",
  "chat:deleted",
] as const satisfies readonly RealtimeEventName[];

/** Socket.IO room name for one chat channel. */
export function chatRoom(channel: string) {
  return `chat:${channel}`;
}

// ---------------------------------------------------------------------------
// Chat channels
//
// Defined here rather than in `lib/chat.ts` because `server.ts` needs them to
// decide room membership at the handshake, and `lib/chat.ts` reaches
// `lib/users.ts` -> `lib/security.ts` -> `next/server`. Importing that chain
// into the custom server crashes it on boot with "AsyncLocalStorage accessed in
// runtime where it is not available".
//
// Everything below is pure: no prisma, no next, no imports at all.
// ---------------------------------------------------------------------------

/** The rooms the portal renders. `slug` is what a client asks for. */
export const CHAT_CHANNELS = [
  {
    slug: "general",
    title: "General Chat",
    description: "All COE students — announcements, reminders and questions for everyone.",
    course: null as string | null,
  },
  {
    slug: "ce",
    title: "CE Live Chat",
    description: "Civil Engineering — plans, surveying, structures and project coordination.",
    course: "CE" as string | null,
  },
  {
    slug: "ee",
    title: "EE Live Chat",
    description: "Electrical Engineering — circuits, power, machines and lab updates.",
    course: "EE" as string | null,
  },
] as const;

/** Roles that reach both course rooms — a lecturer answers in either. */
const CHAT_STAFF_ROLES = ["ADMIN", "REGISTRAR", "FACULTY"];

/**
 * May this account read and post in this channel?
 *
 * General is open to every signed-in account; a course room is for that course
 * plus staff. This is the rule the page has always claimed — "Electrical
 * Engineering only" — it simply was not enforced anywhere before.
 */
export function canAccessChannel(
  slug: string,
  viewer: { role: string | null; discipline: string | null },
) {
  const channel = CHAT_CHANNELS.find((c) => c.slug === slug);
  if (!channel) return false;
  if (!channel.course) return true;
  if (viewer.role && CHAT_STAFF_ROLES.includes(viewer.role)) return true;

  return String(viewer.discipline || "").toUpperCase() === channel.course;
}

/** The channels this account may open. */
export function channelsFor(viewer: { role: string | null; discipline: string | null }) {
  return CHAT_CHANNELS.filter((c) => canAccessChannel(c.slug, viewer));
}

/** All event names, used by `server.ts` to wire up forwarding in one loop. */
export const REALTIME_EVENT_NAMES = [
  ...ADMIN_ONLY_EVENTS,
  ...LIBRARY_EVENTS,
  ...STAFF_EVENTS,
  ...CHAT_EVENTS,
  ...USER_EVENTS,
] as const;

/** Socket.IO room that only authenticated admins are allowed to join. */
export const ADMIN_ROOM = "admin";

/** Socket.IO room every authenticated user joins — the shared library feed. */
export const LIBRARY_ROOM = "library";

/** Faculty, registrars and admins. Receives submission activity. */
export const STAFF_ROOM = "staff";

// ---------------------------------------------------------------------------
// The bus
// ---------------------------------------------------------------------------

// Stored on globalThis so Next's dev-mode module reloading does not create a
// second emitter that `server.ts` is not listening to. This is the same
// pattern used for the Prisma client singleton.
const globalForRealtime = globalThis as unknown as {
  __realtimeBus?: EventEmitter;
};

function getBus() {
  if (!globalForRealtime.__realtimeBus) {
    const bus = new EventEmitter();
    // One listener per event name from server.ts, plus headroom. The default
    // of 10 would print a spurious leak warning as the app grows.
    bus.setMaxListeners(50);
    globalForRealtime.__realtimeBus = bus;
  }
  return globalForRealtime.__realtimeBus;
}

/**
 * Publish an event to the admin dashboard.
 *
 * Fire-and-forget by design: broadcasting is a side effect of an action that
 * has *already* been committed to the database. If the socket layer is down
 * (or we are running under `next dev` with no custom server), the write must
 * still succeed — the dashboard simply falls back to its polling refresh.
 */
export function emitRealtime<E extends RealtimeEventName>(
  event: E,
  payload: RealtimeEvents[E],
) {
  try {
    getBus().emit(event, payload);
  } catch (error) {
    console.error(`[realtime] failed to emit "${event}"`, error);
  }
}

/** Subscribe to an event. Called by `server.ts`; returns an unsubscribe fn. */
export function onRealtime<E extends RealtimeEventName>(
  event: E,
  listener: (payload: RealtimeEvents[E]) => void,
) {
  const bus = getBus();
  bus.on(event, listener as (...args: unknown[]) => void);
  return () => {
    bus.off(event, listener as (...args: unknown[]) => void);
  };
}

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Prisma `User` row into the wire shape above.
 *
 * Note the explicit field list: it is a whitelist, not a convenience. Spreading
 * the row here is how `passwordHash` ends up broadcast to every connected admin
 * socket, so the fields are enumerated on purpose.
 */
export function toRealtimeUser(user: {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  role: string;
  status: string;
  discipline: string | null;
  image: string | null;
  emailVerified: Date | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  loginCount: number;
}): RealtimeUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    discipline: user.discipline,
    image: user.image,
    emailVerified: user.emailVerified?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    lastLoginIp: user.lastLoginIp,
    loginCount: user.loginCount,
  };
}

/**
 * Convert a Prisma `Material` row (with its folder and uploader joined) into
 * the wire shape above.
 *
 * `storageKey` is deliberately absent: it is the internal on-disk location and
 * must never reach a client. Downloads go through an authenticated route that
 * resolves the key server-side.
 */
export function toRealtimeMaterial(material: {
  id: string;
  folderId: string;
  title: string;
  originalName: string;
  description: string | null;
  kind: string;
  mimeType: string;
  extension: string | null;
  sizeBytes: number;
  thumbnailKey: string | null;
  externalUrl: string | null;
  course: string | null;
  year: string | null;
  semester: string | null;
  subject: string | null;
  department: string | null;
  professor: string | null;
  tags: string;
  status: string;
  pinned: boolean;
  viewCount: number;
  downloadCount: number;
  likeCount: number;
  commentCount: number;
  ratingSum: number;
  ratingCount: number;
  uploadedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  folder?: { path: string } | null;
  uploadedBy?: { name: string | null; username: string | null } | null;
}): RealtimeMaterial {
  return {
    id: material.id,
    folderId: material.folderId,
    folderPath: material.folder?.path ?? "",
    title: material.title,
    originalName: material.originalName,
    description: material.description,
    kind: material.kind,
    mimeType: material.mimeType,
    extension: material.extension,
    sizeBytes: material.sizeBytes,
    thumbnailKey: material.thumbnailKey,
    externalUrl: material.externalUrl,
    course: material.course,
    year: material.year,
    semester: material.semester,
    subject: material.subject,
    department: material.department,
    professor: material.professor,
    tags: parseTags(material.tags),
    status: material.status,
    pinned: material.pinned,
    viewCount: material.viewCount,
    downloadCount: material.downloadCount,
    likeCount: material.likeCount,
    commentCount: material.commentCount,
    ratingAverage:
      material.ratingCount > 0
        ? Math.round((material.ratingSum / material.ratingCount) * 10) / 10
        : 0,
    uploadedById: material.uploadedById,
    uploadedByName: material.uploadedBy?.name ?? material.uploadedBy?.username ?? null,
    createdAt: material.createdAt.toISOString(),
    updatedAt: material.updatedAt.toISOString(),
  };
}

/** Decode the JSON-encoded `tags` column; never throws on malformed data. */
export function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];

  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

/** Convert a Prisma `LoginEvent` row into the wire shape above. */
export function toRealtimeLog(event: {
  id: string;
  userId: string | null;
  username: string | null;
  email: string | null;
  type: string;
  success: boolean;
  ipAddress: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  detail: string | null;
  createdAt: Date;
}): RealtimeLog {
  return {
    id: event.id,
    userId: event.userId,
    username: event.username,
    email: event.email,
    type: event.type,
    success: event.success,
    ipAddress: event.ipAddress,
    device: event.device,
    browser: event.browser,
    os: event.os,
    detail: event.detail,
    createdAt: event.createdAt.toISOString(),
  };
}
