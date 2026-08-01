/**
 * Single source of truth for every "enum" in the data model.
 *
 * Prisma's SQLite connector has no `enum` support, so these columns are plain
 * `String` in the schema. That means the database will happily accept any
 * string — so the guarantee has to come from here instead. Every value that
 * reaches a write path is validated against these lists (see
 * `src/lib/validation.ts`), and every one of these arrays is `as const`, so
 * the derived union types are checked at compile time too.
 *
 * Adding a value: add it here first, then to the matching Zod schema.
 */

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const USER_ROLES = [
  "USER",
  "ADMIN",
  "STUDENT",
  "FACULTY",
  "LIBRARIAN",
  "REGISTRAR",
  /**
   * Student-organisation officers (PICE for CE, IIEE for EE).
   *
   * The COE portal has always had these — they publish their org's
   * announcements and see a cut-down admin panel — but the database did not,
   * so setting the role from the admin screen was rejected as an invalid
   * value and silently did nothing.
   *
   * They are deliberately NOT in ADMIN_ROLES, UPLOADER_ROLES,
   * AUTO_APPROVE_ROLES or QA_ANSWERER_ROLES: an officer is a student with one
   * extra publishing right, not a member of staff. The only set they belong to
   * is ANNOUNCER_ROLES below.
   */
  "ORG_OFFICER_PICE",
  "ORG_OFFICER_IIEE",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

// ---------------------------------------------------------------------------
// Account status — drives the admin enable / disable / ban controls
// ---------------------------------------------------------------------------

export const ACCOUNT_STATUSES = ["ACTIVE", "INACTIVE", "BANNED"] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Only ACTIVE accounts may hold a session. */
export function canSignIn(status: string): status is "ACTIVE" {
  return status === "ACTIVE";
}

/** Human-facing copy shown when a non-active account tries to sign in. */
export const STATUS_SIGN_IN_MESSAGE: Record<AccountStatus, string> = {
  ACTIVE: "",
  INACTIVE: "This account has been disabled. Contact an administrator.",
  BANNED: "This account has been banned. Contact an administrator.",
};

// ---------------------------------------------------------------------------
// Security tokens
// ---------------------------------------------------------------------------

export const SECURITY_TOKEN_TYPES = ["EMAIL_VERIFICATION", "PASSWORD_RESET"] as const;

export type SecurityTokenType = (typeof SECURITY_TOKEN_TYPES)[number];

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

/**
 * Every action the brief asks to be logged has a value here. `recordLoginEvent`
 * accepts only these, so a typo becomes a compile error rather than a log entry
 * that silently never shows up in the dashboard filter.
 */
export const LOGIN_EVENT_TYPES = [
  "REGISTER",
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
  "PASSWORD_CHANGE",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET",
  "EMAIL_VERIFIED",
  "PROFILE_UPDATED",
  "ACCOUNT_UPDATED",
  "ACCOUNT_DELETED",
  "STATUS_CHANGED",
  "ROLE_CHANGED",
  "SESSION_REVOKED",
] as const;

export type LoginEventType = (typeof LOGIN_EVENT_TYPES)[number];

/** Labels for the admin activity feed. */
export const LOGIN_EVENT_LABELS: Record<LoginEventType, string> = {
  REGISTER: "Account created",
  LOGIN_SUCCESS: "Signed in",
  LOGIN_FAILED: "Failed sign-in",
  LOGOUT: "Signed out",
  PASSWORD_CHANGE: "Password changed",
  PASSWORD_RESET_REQUESTED: "Password reset requested",
  PASSWORD_RESET: "Password reset",
  EMAIL_VERIFIED: "Email verified",
  PROFILE_UPDATED: "Profile updated",
  ACCOUNT_UPDATED: "Account updated",
  ACCOUNT_DELETED: "Account deleted",
  STATUS_CHANGED: "Status changed",
  ROLE_CHANGED: "Role changed",
  SESSION_REVOKED: "Session revoked",
};

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "ACCESS_DENIED",
  "EXPORT",
  "IMPORT",
  "SECURITY_EVENT",
  "STATUS_CHANGE",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITIES = [
  "USER",
  "STUDENT",
  "FACULTY",
  "COURSE",
  "SECTION",
  "ENROLLMENT",
  "ATTENDANCE",
  "GRADE",
  "BOOK",
  "COPY",
  "LOAN",
  "HOLD",
  "SYSTEM",
  "CHAT",
] as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

// ---------------------------------------------------------------------------
// Academic / library (carried over from the Postgres schema; no UI yet)
// ---------------------------------------------------------------------------

export const ACADEMIC_STATUSES = ["ACTIVE", "INACTIVE", "GRADUATED", "SUSPENDED"] as const;
export type AcademicStatus = (typeof ACADEMIC_STATUSES)[number];

export const ENROLLMENT_STATUSES = ["ENROLLED", "WAITLISTED", "DROPPED", "COMPLETED"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const COURSE_SECTION_STATUSES = ["PLANNED", "OPEN", "CLOSED", "COMPLETED"] as const;
export type CourseSectionStatus = (typeof COURSE_SECTION_STATUSES)[number];

export const BOOK_COPY_STATUSES = [
  "AVAILABLE",
  "ON_LOAN",
  "RESERVED",
  "MAINTENANCE",
  "LOST",
] as const;
export type BookCopyStatus = (typeof BOOK_COPY_STATUSES)[number];

export const LIBRARY_LOAN_STATUSES = ["ACTIVE", "RETURNED", "OVERDUE", "LOST"] as const;
export type LibraryLoanStatus = (typeof LIBRARY_LOAN_STATUSES)[number];

export const LIBRARY_HOLD_STATUSES = ["ACTIVE", "FULFILLED", "CANCELLED", "EXPIRED"] as const;
export type LibraryHoldStatus = (typeof LIBRARY_HOLD_STATUSES)[number];

// ---------------------------------------------------------------------------
// Chat (carried over; no UI yet)
// ---------------------------------------------------------------------------

export const CHAT_CONVERSATION_TYPES = ["DIRECT", "CHANNEL", "GROUP", "SUPPORT"] as const;
export type ChatConversationType = (typeof CHAT_CONVERSATION_TYPES)[number];

export const CHAT_MEMBER_ROLES = ["OWNER", "ADMIN", "STAFF", "MEMBER"] as const;
export type ChatMemberRole = (typeof CHAT_MEMBER_ROLES)[number];

export const CHAT_MESSAGE_TYPES = ["TEXT", "IMAGE", "FILE", "VOICE", "SYSTEM"] as const;
export type ChatMessageType = (typeof CHAT_MESSAGE_TYPES)[number];

export const CHAT_REPORT_STATUSES = ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"] as const;
export type ChatReportStatus = (typeof CHAT_REPORT_STATUSES)[number];

export const CHAT_TICKET_STATUSES = ["OPEN", "PENDING", "RESOLVED", "CLOSED"] as const;
export type ChatTicketStatus = (typeof CHAT_TICKET_STATUSES)[number];

// ---------------------------------------------------------------------------
// Engineering Library — shared digital repository
// ---------------------------------------------------------------------------

/** Levels of the library tree. */
export const FOLDER_KINDS = [
  "ROOT",
  "COURSE",
  "YEAR",
  "SUBJECT",
  "PROFESSOR",
  "CATEGORY",
  "CUSTOM",
] as const;
export type FolderKind = (typeof FOLDER_KINDS)[number];

/**
 * Material categories. These mirror the categories the existing portal already
 * uses (`MATERIAL_CATEGORIES` in `enhanced-library.js`) so the seeded folder
 * tree matches what students are used to seeing.
 */
export const MATERIAL_KINDS = [
  "REFERENCE",
  "HANDOUT",
  "VIDEO",
  "LESSON",
  "LINK",
  "OTHER",
] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export const MATERIAL_KIND_LABELS: Record<MaterialKind, string> = {
  REFERENCE: "Reference Books",
  HANDOUT: "Handouts",
  VIDEO: "Video Lectures",
  LESSON: "Lessons",
  LINK: "Google Drive Links",
  OTHER: "Other",
};

/** Upload moderation state. */
export const MATERIAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

export const REPORT_REASONS = [
  "BROKEN_FILE",
  "WRONG_FOLDER",
  "COPYRIGHT",
  "INAPPROPRIATE",
  "OTHER",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["OPEN", "RESOLVED", "DISMISSED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "MATERIAL_UPLOADED",
  "MATERIAL_APPROVED",
  "MATERIAL_REJECTED",
  "COMMENT_REPLY",
  "MATERIAL_REPORTED",
  "SYSTEM",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Sort orders offered by the library toolbar. */
export const MATERIAL_SORTS = [
  "recent",
  "oldest",
  "downloads",
  "views",
  "likes",
  "rating",
  "alphabetical",
] as const;
export type MaterialSort = (typeof MATERIAL_SORTS)[number];

/**
 * Roles permitted to upload without moderation. Everyone else's uploads land
 * in PENDING and wait for an admin to approve them.
 */
export const AUTO_APPROVE_ROLES: readonly UserRole[] = [
  "ADMIN",
  "FACULTY",
  "LIBRARIAN",
  "REGISTRAR",
];

/**
 * Roles permitted to upload at all.
 *
 * Administrators only, by decision: the library is published *to* the college
 * rather than contributed to by it. Reading is deliberately unrestricted — see
 * `listMaterials`, where every signed-in account queries the same rows with no
 * role filter — so this narrows who can add, never who can see.
 *
 * A side effect worth knowing: every remaining uploader is also in
 * AUTO_APPROVE_ROLES, so nothing lands in PENDING any more and the approval
 * queue stays empty. It is left in place for rows queued before this change,
 * and it is the one thing to revisit if FACULTY is added back below.
 *
 * To let faculty upload again, add "FACULTY" here — nothing else needs to
 * change, because the approval path still exists.
 */
export const UPLOADER_ROLES: readonly UserRole[] = ["ADMIN"];

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** "REGISTRAR" -> "Registrar", "LOGIN_SUCCESS" -> "Login Success" */
export function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
