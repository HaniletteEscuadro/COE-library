import { z } from "zod";
import {
  ACCOUNT_STATUSES,
  FOLDER_KINDS,
  LOGIN_EVENT_TYPES,
  MATERIAL_KINDS,
  MATERIAL_SORTS,
  MATERIAL_STATUSES,
  REPORT_REASONS,
  USER_ROLES,
} from "@/lib/enums";

/**
 * Every value entering the system is parsed here first.
 *
 * These schemas are the trust boundary: route handlers parse their input with
 * one of them and only ever touch `parsed.data`, so unvalidated request bodies
 * never reach Prisma. Enum-ish columns are plain strings in SQLite, which makes
 * the `z.enum` checks below the only thing standing between a crafted request
 * and a user row with `role: "SUPERUSER"`.
 */

// ---------------------------------------------------------------------------
// Shared field rules
// ---------------------------------------------------------------------------

const strongPassword = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Password is too long.")
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[0-9]/, "Add a number.")
  .regex(/[^A-Za-z0-9]/, "Add a symbol.");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address.")
  .max(254, "Email address is too long.")
  .email("Enter a valid email address.");

/**
 * Login handle. Restricted to a conservative character set so a username can
 * never be mistaken for an email, contain markup, or collide after
 * normalisation. The leading "@" is optional on input and added on save.
 */
const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Usernames need at least 3 characters.")
  .max(32, "Usernames can be at most 32 characters.")
  .regex(
    /^@?[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/,
    "Use letters, numbers, dots, underscores or hyphens only.",
  );

const displayName = z
  .string()
  .trim()
  .min(2, "Enter your full name.")
  .max(80, "Name is too long.");

/** Course / discipline code as used by the COE portal. */
const discipline = z
  .string()
  .trim()
  .toUpperCase()
  .max(16, "Course code is too long.")
  .regex(/^[A-Z0-9-]*$/, "Use letters and numbers only.");

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email,
  // Deliberately only `min(1)`: applying the strong-password rules at login
  // would reject legacy passwords and leak the policy to attackers.
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean().default(false),
});

export const registerSchema = z
  .object({
    name: displayName,
    username,
    email,
    discipline: discipline.optional().default(""),
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(24, "Reset token is missing."),
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const verifyEmailSchema = z.object({
  token: z.string().min(24, "Verification token is missing."),
});

export const resendVerificationSchema = z.object({ email });

// ---------------------------------------------------------------------------
// Self-service account management
// ---------------------------------------------------------------------------

export const profileSchema = z.object({
  name: displayName,
  discipline: discipline.optional().default(""),
  image: z
    .string()
    .trim()
    .url("Enter a valid image URL.")
    .max(500)
    .or(z.literal(""))
    .optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

// ---------------------------------------------------------------------------
// Admin: user management
// ---------------------------------------------------------------------------

/**
 * Admin edit. Every field is optional so the UI can PATCH just what changed,
 * but at least one must be present — an empty body would otherwise produce a
 * "success" response that did nothing.
 */
export const adminUpdateUserSchema = z
  .object({
    name: displayName.optional(),
    username: username.optional(),
    email: email.optional(),
    discipline: discipline.optional(),
    role: z.enum(USER_ROLES).optional(),
    status: z.enum(ACCOUNT_STATUSES).optional(),
    statusReason: z.string().trim().max(280, "Reason is too long.").optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "No changes were supplied.",
  });

export const adminCreateUserSchema = z.object({
  name: displayName,
  username,
  email,
  discipline: discipline.optional().default(""),
  role: z.enum(USER_ROLES).default("STUDENT"),
  status: z.enum(ACCOUNT_STATUSES).default("ACTIVE"),
  password: strongPassword,
});

export const adminStatusSchema = z.object({
  status: z.enum(ACCOUNT_STATUSES),
  reason: z.string().trim().max(280, "Reason is too long.").optional(),
});

// ---------------------------------------------------------------------------
// Admin: querying (search / filter / sort / paginate)
// ---------------------------------------------------------------------------

/** Whitelist of sortable columns — prevents arbitrary column names in orderBy. */
export const USER_SORT_FIELDS = [
  "createdAt",
  "lastLoginAt",
  "name",
  "email",
  "username",
  "role",
  "status",
] as const;

export const adminUserQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
  sort: z.enum(USER_SORT_FIELDS).optional().default("createdAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().min(1).optional().default(1),
  // Capped so a caller cannot request the entire table in one query.
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  includeDeleted: z.coerce.boolean().optional().default(false),
});

export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;

export const adminLogQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  type: z.enum(LOGIN_EVENT_TYPES).optional(),
  userId: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export type AdminLogQuery = z.infer<typeof adminLogQuerySchema>;

// ---------------------------------------------------------------------------
// Engineering Library
// ---------------------------------------------------------------------------

/**
 * Tags arrive either as a real array (JSON body) or a comma-separated string
 * (multipart form field), so both are accepted and normalised to an array.
 */
const tagList = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((value) => {
    if (!value) return [] as string[];
    const raw = Array.isArray(value) ? value : value.split(",");
    return raw
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 15);
  });

export const materialUploadSchema = z.object({
  folderId: z.string().min(1, "Choose a folder."),
  title: z.string().trim().min(2, "Give this material a title.").max(160, "Title is too long."),
  description: z.string().trim().max(2000, "Description is too long.").optional().default(""),
  kind: z.enum(MATERIAL_KINDS).optional().default("OTHER"),
  semester: z.string().trim().max(40).optional().default(""),
  professor: z.string().trim().max(120).optional().default(""),
  tags: tagList,
  /** For Google Drive / YouTube entries, which have no uploaded file. */
  externalUrl: z.string().trim().url("Enter a valid link.").max(1000).optional().or(z.literal("")),
});

export const materialUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(2000).optional(),
    kind: z.enum(MATERIAL_KINDS).optional(),
    semester: z.string().trim().max(40).optional(),
    professor: z.string().trim().max(120).optional(),
    tags: tagList,
    pinned: z.boolean().optional(),
    folderId: z.string().min(1).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "No changes were supplied.",
  });

export const materialReviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(500).optional(),
});

/** Query params for the library grid. */
export const materialQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  folderId: z.string().trim().max(64).optional(),
  recursive: z.coerce.boolean().optional().default(false),
  course: z.string().trim().max(40).optional(),
  year: z.string().trim().max(40).optional(),
  semester: z.string().trim().max(40).optional(),
  subject: z.string().trim().max(160).optional(),
  department: z.string().trim().max(120).optional(),
  kind: z.enum(MATERIAL_KINDS).optional(),
  extension: z.string().trim().max(10).optional(),
  tag: z.string().trim().max(40).optional(),
  uploadedById: z.string().trim().max(64).optional(),
  status: z.enum(MATERIAL_STATUSES).optional(),
  uploadedAfter: z.string().trim().max(40).optional(),
  sort: z.enum(MATERIAL_SORTS).optional().default("recent"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(24),
});

export const folderCreateSchema = z.object({
  parentId: z.string().trim().max(64).optional().nullable(),
  name: z.string().trim().min(1, "Name the folder.").max(120, "Folder name is too long."),
  kind: z.enum(FOLDER_KINDS).optional().default("CUSTOM"),
  description: z.string().trim().max(500).optional(),
  icon: z.string().trim().max(40).optional(),
  color: z.string().trim().max(20).optional(),
  restricted: z.boolean().optional().default(false),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Write something first.").max(2000, "Comments are limited to 2000 characters."),
  parentId: z.string().trim().max(64).optional().nullable(),
});

export const ratingSchema = z.object({
  score: z.coerce.number().int().min(1, "Rate between 1 and 5.").max(5, "Rate between 1 and 5."),
});

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
});

export const bookmarkSchema = z.object({
  note: z.string().trim().max(500).optional(),
  lastPage: z.coerce.number().int().min(0).max(100000).optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
});

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

export const ANNOUNCEMENT_CATEGORIES = [
  "GENERAL",
  "ACADEMIC",
  "EVENT",
  "URGENT",
  "SYSTEM",
] as const;

export const ANNOUNCEMENT_PRIORITIES = ["NORMAL", "HIGH", "URGENT"] as const;

export const announcementCreateSchema = z.object({
  title: z.string().trim().min(3, "Give the announcement a title.").max(160, "Title is too long."),
  body: z.string().trim().min(1, "Write the announcement.").max(5000, "Announcement is too long."),
  category: z.enum(ANNOUNCEMENT_CATEGORIES).optional().default("GENERAL"),
  priority: z.enum(ANNOUNCEMENT_PRIORITIES).optional().default("NORMAL"),
  course: z.string().trim().max(16).optional().default(""),
  year: z.string().trim().max(40).optional().default(""),
  /**
   * Which body is publishing. Validated only for shape here — whether this
   * account may actually publish as it is decided by `canPostToOrg`, because
   * that depends on the caller's role and a schema cannot see it.
   */
  org: z.string().trim().max(16).optional().default(""),
  pinned: z.boolean().optional().default(false),
  /** ISO date; blank clears any existing expiry. */
  expiresAt: z.string().trim().max(40).optional().or(z.literal("")).nullable(),
});

export const announcementUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    body: z.string().trim().min(1).max(5000).optional(),
    category: z.enum(ANNOUNCEMENT_CATEGORIES).optional(),
    priority: z.enum(ANNOUNCEMENT_PRIORITIES).optional(),
    course: z.string().trim().max(16).optional(),
    year: z.string().trim().max(40).optional(),
    pinned: z.boolean().optional(),
    expiresAt: z.string().trim().max(40).optional().or(z.literal("")).nullable(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "No changes were supplied.",
  });

export const announcementQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  category: z.enum(ANNOUNCEMENT_CATEGORIES).optional(),
  course: z.string().trim().max(16).optional(),
  /** Narrow to one organisation's board; college-wide notices come too. */
  org: z.string().trim().max(16).optional(),
  year: z.string().trim().max(40).optional(),
  includeInactive: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});
// ---------------------------------------------------------------------------
// Assignments and submissions
// ---------------------------------------------------------------------------

export const ASSIGNMENT_STATUSES = ["DRAFT", "OPEN", "CLOSED"] as const;
export const SUBMISSION_STATUSES = ["DRAFT", "SUBMITTED", "RETURNED", "RESUBMITTED"] as const;

export const assignmentCreateSchema = z.object({
  title: z.string().trim().min(3, "Give the assignment a title.").max(160, "Title is too long."),
  description: z.string().trim().max(2000).optional().default(""),
  instructions: z.string().trim().max(8000).optional().default(""),
  course: z.string().trim().max(16).optional().default(""),
  year: z.string().trim().max(40).optional().default(""),
  subject: z.string().trim().max(160).optional().default(""),
  status: z.enum(ASSIGNMENT_STATUSES).optional().default("OPEN"),
  dueAt: z.string().trim().max(40).optional().or(z.literal("")).nullable(),
  points: z.coerce.number().int().min(1, "Points must be at least 1.").max(1000).optional().default(100),
  allowLate: z.boolean().optional().default(true),
  /** Expected answer for the COE portal's auto-check. Never sent back to a student. */
  answerKey: z.string().trim().max(500).optional().default(""),
});

export const assignmentQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  course: z.string().trim().max(16).optional(),
  year: z.string().trim().max(40).optional(),
  subject: z.string().trim().max(160).optional(),
  status: z.enum(ASSIGNMENT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const submissionCreateSchema = z.object({
  content: z.string().trim().max(20000, "Answer is too long.").optional().default(""),
});

export const submissionGradeSchema = z
  .object({
    // Bounded against the assignment's own `points` in the service layer,
    // which is the only place that knows the maximum.
    score: z.coerce.number().min(0).max(1000).optional().nullable(),
    feedback: z.string().trim().max(4000).optional(),
    status: z.enum(SUBMISSION_STATUSES).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "No changes were supplied.",
  });
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flatten a ZodError into `{ field: message }` for form rendering, plus a
 * single `message` suitable for a toast.
 */
export function formatZodError(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    // Keep the first error per field; later ones are usually consequences.
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return {
    message: error.issues[0]?.message ?? "Please check the form and try again.",
    fieldErrors,
  };
}



// ---------------------------------------------------------------------------
// COESC — student council
// ---------------------------------------------------------------------------

/**
 * Renaming the holder of a council seat.
 *
 * `position` is deliberately absent: the seat key is seeded and immutable, so
 * accepting it here would let an administrator turn the Treasurer row into a
 * second Governor and break the fixed org chart the tab renders.
 */
export const councilOfficerUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the officer's full name.")
    .max(80, "That name is too long.")
    .optional(),
  course: z
    .string()
    .trim()
    .toUpperCase()
    .max(8)
    .or(z.literal(""))
    .optional(),
});

/** A student applying to a COESC committee. */
export const committeeApplicationSchema = z.object({
  committee: z.string().trim().min(1, "Choose a committee."),
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(80, "That name is too long."),
  course: z.enum(["CE", "EE"], { message: "Choose CE or EE." }),
  yearLevel: z.string().trim().min(1, "Choose your year level.").max(20),
  contact: z
    .string()
    .trim()
    .max(80, "That contact detail is too long.")
    .or(z.literal(""))
    .optional(),
  message: z
    .string()
    .trim()
    .min(20, "Tell the council a little about why you want to join (20+ characters).")
    .max(1200, "Keep it under 1200 characters."),
});

/**
 * A reviewer's decision.
 *
 * "PENDING" is not accepted: this schema is for making a decision, and allowing
 * it would let a reviewer silently un-decide an application that the applicant
 * has already been notified about.
 */
export const applicationReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"], { message: "Choose approve or reject." }),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").or(z.literal("")).optional(),
});
