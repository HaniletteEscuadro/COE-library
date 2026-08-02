/**
 * Engineering Library — folders and materials.
 *
 * The shared-drive model: there is exactly one library, every signed-in user
 * reads the same content, and writes are gated by role rather than ownership.
 * Route handlers stay thin and call in here, which is what guarantees that
 * every mutation also updates the denormalised counters and broadcasts itself.
 *
 * Social interactions (likes, comments, views, downloads, ratings, reports)
 * live in `library-social.ts` to keep this file to one responsibility.
 *
 * Nothing here imports `next/*`.
 */

import { prisma } from "@/lib/prisma";
import { emitRealtime, toRealtimeMaterial, parseTags } from "@/lib/realtime";
import { recordAuditLog } from "@/lib/audit";
import { UserServiceError, type ActorContext } from "@/lib/users";
import {
  AUTO_APPROVE_ROLES,
  UPLOADER_ROLES,
  type MaterialKind,
  type MaterialSort,
  type MaterialStatus,
} from "@/lib/enums";
import { ADMIN_ROLES, hasRole } from "@/lib/rbac";
import { getStorageUsage } from "@/lib/quota";
import { removeFile } from "@/lib/storage";

/**
 * Joins needed to serialise a material for the wire. Kept as one constant so
 * every query that feeds `toRealtimeMaterial` selects a compatible shape.
 */
const MATERIAL_INCLUDE = {
  folder: { select: { path: true, name: true } },
  uploadedBy: { select: { id: true, name: true, username: true, image: true } },
} as const;

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export function canUpload(role: string | null | undefined) {
  return hasRole(role, UPLOADER_ROLES);
}

export function canModerate(role: string | null | undefined) {
  return hasRole(role, ADMIN_ROLES);
}

/** Uploads from trusted roles skip the approval queue. */
export function autoApproves(role: string | null | undefined) {
  return hasRole(role, AUTO_APPROVE_ROLES);
}

/**
 * Editing is allowed for moderators, or for the original uploader on their own
 * material. Checked server-side on every mutation — the UI hiding a button is
 * not access control.
 */
export function canEditMaterial(
  actor: { id?: string | null; role?: string | null },
  material: { uploadedById: string | null },
) {
  if (canModerate(actor.role)) return true;
  return Boolean(actor.id && material.uploadedById && actor.id === material.uploadedById);
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

/** URL-safe slug: "CIE 113 - MECHANICS" -> "cie-113-mechanics". */
export function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
}

/**
 * Fetch the whole folder tree in one query and assemble it in memory.
 *
 * A recursive walk would issue one query per level; the tree is small enough
 * (a few hundred nodes) that reading it flat and linking it here is both
 * simpler and faster.
 */
export async function getFolderTree() {
  const folders = await prisma.libraryFolder.findMany({
    where: { deletedAt: null },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      parentId: true,
      name: true,
      slug: true,
      path: true,
      kind: true,
      icon: true,
      color: true,
      course: true,
      year: true,
      subject: true,
      restricted: true,
      materialCount: true,
    },
  });

  type Node = (typeof folders)[number] & { children: Node[]; totalCount: number };

  const byId = new Map<string, Node>();
  for (const folder of folders) {
    byId.set(folder.id, { ...folder, children: [], totalCount: folder.materialCount });
  }

  const roots: Node[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  // Roll descendant counts up so a course node shows everything beneath it.
  const accumulate = (node: Node): number => {
    node.totalCount = node.materialCount + node.children.reduce((sum, c) => sum + accumulate(c), 0);
    return node.totalCount;
  };
  roots.forEach(accumulate);

  return roots;
}

/** Every ancestor id of a folder, derived from its cached `path`. */
async function getAncestorIds(folderId: string) {
  const folder = await prisma.libraryFolder.findUnique({
    where: { id: folderId },
    select: { path: true },
  });

  if (!folder) return [];

  // path is "/root-slug/child-slug/", so ancestors are its prefixes.
  const segments = folder.path.split("/").filter(Boolean);
  const prefixes = segments.slice(0, -1).map((_, index) => `/${segments.slice(0, index + 1).join("/")}/`);

  if (prefixes.length === 0) return [];

  const ancestors = await prisma.libraryFolder.findMany({
    where: { path: { in: prefixes } },
    select: { id: true },
  });

  return ancestors.map((ancestor) => ancestor.id);
}

/**
 * Recompute a folder's material count and broadcast it.
 *
 * Called after any change that moves a material in or out of a folder. Counting
 * with an aggregate rather than incrementing keeps the cached value
 * self-healing: a bug elsewhere cannot leave it permanently wrong.
 */
export async function refreshFolderCount(folderId: string) {
  const materialCount = await prisma.material.count({
    where: { folderId, status: "APPROVED", deletedAt: null },
  });

  await prisma.libraryFolder.update({
    where: { id: folderId },
    data: { materialCount },
  });

  const ancestorIds = await getAncestorIds(folderId);

  emitRealtime("folder:counts", { folderId, materialCount, ancestorIds });

  return materialCount;
}

/** Create a folder beneath `parentId`, inheriting classification context. */
export async function createFolder(
  input: {
    parentId?: string | null;
    name: string;
    kind?: string;
    description?: string;
    icon?: string;
    color?: string;
    restricted?: boolean;
  },
  actor: ActorContext & { role?: string | null },
) {
  if (!canModerate(actor.role)) {
    throw new UserServiceError("Only administrators can create folders.", 403);
  }

  const slug = slugify(input.name);
  let parent = null;

  if (input.parentId) {
    parent = await prisma.libraryFolder.findUnique({ where: { id: input.parentId } });
    if (!parent || parent.deletedAt) {
      throw new UserServiceError("That parent folder no longer exists.", 404);
    }
  }

  const path = `${parent ? parent.path : "/"}${slug}/`;

  try {
    const folder = await prisma.libraryFolder.create({
      data: {
        parentId: parent?.id ?? null,
        name: input.name.trim(),
        slug,
        path,
        kind: input.kind ?? "CUSTOM",
        description: input.description ?? null,
        icon: input.icon ?? null,
        color: input.color ?? null,
        restricted: input.restricted ?? false,
        // Inherit context so materials filed here are classified automatically.
        course: parent?.course ?? null,
        year: parent?.year ?? null,
        subject: parent?.subject ?? null,
        department: parent?.department ?? null,
        createdById: actor.actorId ?? null,
      },
    });

    emitRealtime("folder:changed", {
      id: folder.id,
      parentId: folder.parentId,
      name: folder.name,
      path: folder.path,
    });

    await recordAuditLog({
      actorId: actor.actorId,
      action: "CREATE",
      entity: "SYSTEM",
      entityId: folder.id,
      message: `Created library folder ${folder.path}`,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return folder;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new UserServiceError("A folder with that name already exists here.", 409, "name");
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Materials — reading
// ---------------------------------------------------------------------------

export type MaterialQuery = {
  search?: string;
  folderId?: string;
  /** Include materials in descendant folders too. */
  recursive?: boolean;
  course?: string;
  year?: string;
  semester?: string;
  subject?: string;
  department?: string;
  kind?: MaterialKind;
  extension?: string;
  tag?: string;
  uploadedById?: string;
  status?: MaterialStatus;
  /** ISO date — only materials uploaded on or after. */
  uploadedAfter?: string;
  sort?: MaterialSort;
  page?: number;
  pageSize?: number;
  /** Moderators only; surfaces soft-deleted rows for restore. */
  includeDeleted?: boolean;
};

/** Map a UI sort option onto an indexed `orderBy`. */
function buildOrderBy(sort: MaterialSort = "recent") {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" as const }];
    case "downloads":
      return [{ downloadCount: "desc" as const }, { createdAt: "desc" as const }];
    case "views":
      return [{ viewCount: "desc" as const }, { createdAt: "desc" as const }];
    case "likes":
      return [{ likeCount: "desc" as const }, { createdAt: "desc" as const }];
    case "rating":
      return [{ ratingSum: "desc" as const }, { ratingCount: "desc" as const }];
    case "alphabetical":
      return [{ title: "asc" as const }];
    case "recent":
    default:
      return [{ createdAt: "desc" as const }];
  }
}

/**
 * Search / filter / sort / paginate the library grid.
 *
 * On `search`: Prisma's `mode: "insensitive"` is PostgreSQL-only. It is not
 * needed here because `contains` compiles to SQL `LIKE`, which SQLite already
 * treats case-insensitively for ASCII.
 */
export async function listMaterials(query: MaterialQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 24));

  // Folder scoping: `recursive` matches on the cached path prefix, which is
  // exactly why `path` is materialised on the row.
  let folderFilter = {};
  if (query.folderId) {
    if (query.recursive) {
      const folder = await prisma.libraryFolder.findUnique({
        where: { id: query.folderId },
        select: { path: true },
      });

      if (folder) {
        const descendants = await prisma.libraryFolder.findMany({
          where: { path: { startsWith: folder.path } },
          select: { id: true },
        });
        folderFilter = { folderId: { in: descendants.map((d) => d.id) } };
      }
    } else {
      folderFilter = { folderId: query.folderId };
    }
  }

  const where = {
    ...(query.includeDeleted ? {} : { deletedAt: null }),
    // Students only ever see approved content; moderators can ask for others.
    status: query.status ?? "APPROVED",
    ...folderFilter,
    ...(query.course ? { course: query.course } : {}),
    ...(query.year ? { year: query.year } : {}),
    ...(query.semester ? { semester: query.semester } : {}),
    ...(query.subject ? { subject: query.subject } : {}),
    ...(query.department ? { department: query.department } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.extension ? { extension: query.extension.toLowerCase() } : {}),
    ...(query.uploadedById ? { uploadedById: query.uploadedById } : {}),
    ...(query.uploadedAfter ? { createdAt: { gte: new Date(query.uploadedAfter) } } : {}),
    // Tag filtering goes through the normalised join table, not a LIKE over
    // the JSON column.
    ...(query.tag
      ? { materialTags: { some: { tag: query.tag.toLowerCase() } } }
      : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search } },
            { description: { contains: query.search } },
            { originalName: { contains: query.search } },
            { subject: { contains: query.search } },
            { course: { contains: query.search } },
            { department: { contains: query.search } },
            { professor: { contains: query.search } },
            { materialTags: { some: { tag: { contains: query.search.toLowerCase() } } } },
            { uploadedBy: { name: { contains: query.search } } },
            { uploadedBy: { username: { contains: query.search.toLowerCase() } } },
          ],
        }
      : {}),
  };

  const [materials, total] = await Promise.all([
    prisma.material.findMany({
      where,
      include: MATERIAL_INCLUDE,
      // Pinned always float to the top, then the requested order.
      orderBy: [{ pinned: "desc" }, ...buildOrderBy(query.sort)],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.material.count({ where }),
  ]);

  return {
    materials: materials.map(toRealtimeMaterial),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    hasMore: page * pageSize < total,
  };
}

/** Single material with everything the detail modal needs. */
export async function getMaterial(id: string) {
  return prisma.material.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...MATERIAL_INCLUDE,
      materialTags: { select: { tag: true } },
      _count: { select: { comments: true, likes: true, favorites: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Materials — writing
// ---------------------------------------------------------------------------

/**
 * Record an uploaded material.
 *
 * The file bytes are written to storage by the route handler *before* this is
 * called; this persists the metadata and performs the broadcast that makes the
 * card appear in every open library.
 */
export async function createMaterial(
  input: {
    folderId: string;
    title: string;
    description?: string;
    kind?: MaterialKind;
    originalName: string;
    storageKey?: string | null;
    externalUrl?: string | null;
    mimeType: string;
    extension?: string | null;
    sizeBytes: number;
    checksum?: string | null;
    thumbnailKey?: string | null;
    tags?: string[];
    semester?: string;
    professor?: string;
  },
  actor: ActorContext & { role?: string | null; actorName?: string | null },
) {
  if (!canUpload(actor.role)) {
    throw new UserServiceError("You do not have permission to upload materials.", 403);
  }

  const folder = await prisma.libraryFolder.findFirst({
    where: { id: input.folderId, deletedAt: null },
  });

  if (!folder) {
    throw new UserServiceError("That folder no longer exists.", 404, "folderId");
  }

  if (folder.restricted && !autoApproves(actor.role)) {
    throw new UserServiceError("Only faculty and administrators can upload to this folder.", 403);
  }

  // --- Duplicate detection ---------------------------------------------
  // Same bytes already in the same folder. Checked on the checksum rather than
  // the filename, so a re-upload under a new name is still caught.
  if (input.checksum) {
    const duplicate = await prisma.material.findFirst({
      where: { checksum: input.checksum, folderId: input.folderId, deletedAt: null },
      select: { id: true, title: true },
    });

    if (duplicate) {
      throw new UserServiceError(
        `"${duplicate.title}" is already in this folder with identical contents.`,
        409,
        "file",
      );
    }
  }

  const tags = normalizeTags(input.tags);
  const status: MaterialStatus = autoApproves(actor.role) ? "APPROVED" : "PENDING";

  const material = await prisma.material.create({
    data: {
      folderId: folder.id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      kind: input.kind ?? "OTHER",
      originalName: input.originalName,
      storageKey: input.storageKey ?? null,
      externalUrl: input.externalUrl ?? null,
      mimeType: input.mimeType,
      extension: input.extension?.toLowerCase() ?? null,
      sizeBytes: input.sizeBytes,
      checksum: input.checksum ?? null,
      thumbnailKey: input.thumbnailKey ?? null,
      tags: JSON.stringify(tags),
      // Classification is inherited from the folder, so filters work without
      // asking the uploader to retype what the folder already implies.
      course: folder.course,
      year: folder.year,
      subject: folder.subject,
      department: folder.department,
      semester: input.semester ?? null,
      professor: input.professor ?? null,
      status,
      reviewedById: status === "APPROVED" ? (actor.actorId ?? null) : null,
      reviewedAt: status === "APPROVED" ? new Date() : null,
      uploadedById: actor.actorId ?? null,
      // Mirror tags into the indexed join table in the same transaction.
      materialTags: { create: tags.map((tag) => ({ tag })) },
    },
    include: MATERIAL_INCLUDE,
  });

  // --- The live hop -----------------------------------------------------
  // Only approved material is broadcast; pending uploads would otherwise
  // appear in every student's grid before a moderator had seen them.
  if (status === "APPROVED") {
    emitRealtime("material:created", toRealtimeMaterial(material));
    await refreshFolderCount(folder.id);
    await broadcastLibraryStats();
    await notifyUpload(material, actor.actorName ?? null);
  } else {
    await notifyModeratorsOfPending(material, actor.actorName ?? null);
  }

  await recordAuditLog({
    actorId: actor.actorId,
    action: "CREATE",
    entity: "BOOK",
    entityId: material.id,
    message: `Uploaded "${material.title}" to ${folder.path}`,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    metadata: { status, sizeBytes: input.sizeBytes, mimeType: input.mimeType },
  });

  return material;
}

/** Edit metadata. Tags are re-synced to the join table when supplied. */
export async function updateMaterial(
  id: string,
  changes: {
    title?: string;
    description?: string;
    kind?: MaterialKind;
    tags?: string[];
    semester?: string;
    professor?: string;
    pinned?: boolean;
    folderId?: string;
  },
  actor: ActorContext & { role?: string | null },
) {
  const existing = await prisma.material.findFirst({ where: { id, deletedAt: null } });

  if (!existing) throw new UserServiceError("That material no longer exists.", 404);

  if (!canEditMaterial({ id: actor.actorId, role: actor.role }, existing)) {
    throw new UserServiceError("You can only edit your own uploads.", 403);
  }

  // Pinning is a curation decision, not an ownership one.
  if (changes.pinned !== undefined && !canModerate(actor.role)) {
    throw new UserServiceError("Only administrators can pin materials.", 403);
  }

  const data: Record<string, unknown> = {};
  if (changes.title !== undefined) data.title = changes.title.trim();
  if (changes.description !== undefined) data.description = changes.description.trim() || null;
  if (changes.kind !== undefined) data.kind = changes.kind;
  if (changes.semester !== undefined) data.semester = changes.semester || null;
  if (changes.professor !== undefined) data.professor = changes.professor || null;
  if (changes.pinned !== undefined) data.pinned = changes.pinned;

  const tags = changes.tags ? normalizeTags(changes.tags) : null;
  if (tags) data.tags = JSON.stringify(tags);

  // Moving re-inherits classification from the destination folder.
  let destination = null;
  if (changes.folderId && changes.folderId !== existing.folderId) {
    if (!canModerate(actor.role)) {
      throw new UserServiceError("Only administrators can move materials.", 403);
    }

    destination = await prisma.libraryFolder.findFirst({
      where: { id: changes.folderId, deletedAt: null },
    });

    if (!destination) throw new UserServiceError("That destination folder does not exist.", 404);

    data.folderId = destination.id;
    data.course = destination.course;
    data.year = destination.year;
    data.subject = destination.subject;
    data.department = destination.department;
  }

  const material = await prisma.$transaction(async (tx) => {
    if (tags) {
      await tx.materialTag.deleteMany({ where: { materialId: id } });
      await tx.materialTag.createMany({ data: tags.map((tag) => ({ materialId: id, tag })) });
    }

    return tx.material.update({ where: { id }, data, include: MATERIAL_INCLUDE });
  });

  emitRealtime("material:updated", toRealtimeMaterial(material));

  // A move changes two folders' counts.
  if (destination) {
    await refreshFolderCount(existing.folderId);
    await refreshFolderCount(destination.id);
  }

  await recordAuditLog({
    actorId: actor.actorId,
    action: "UPDATE",
    entity: "BOOK",
    entityId: id,
    message: `Updated material "${material.title}"`,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    metadata: { changedFields: Object.keys(data) },
  });

  return material;
}

/** Approve or reject a pending upload. */
export async function reviewMaterial(
  id: string,
  decision: "APPROVED" | "REJECTED",
  note: string | undefined,
  actor: ActorContext & { role?: string | null },
) {
  if (!canModerate(actor.role)) {
    throw new UserServiceError("Only administrators can review uploads.", 403);
  }

  const material = await prisma.material.update({
    where: { id },
    data: {
      status: decision,
      rejectionNote: decision === "REJECTED" ? (note ?? null) : null,
      reviewedById: actor.actorId ?? null,
      reviewedAt: new Date(),
    },
    include: MATERIAL_INCLUDE,
  });

  if (decision === "APPROVED") {
    // Now visible to everyone — this is its first appearance in the grid.
    emitRealtime("material:created", toRealtimeMaterial(material));
    await refreshFolderCount(material.folderId);
    await notifyUpload(material, material.uploadedBy?.name ?? null);
  }

  // Tell the uploader either way.
  if (material.uploadedById) {
    await createNotification({
      userId: material.uploadedById,
      type: decision === "APPROVED" ? "MATERIAL_APPROVED" : "MATERIAL_REJECTED",
      title:
        decision === "APPROVED"
          ? `"${material.title}" was approved`
          : `"${material.title}" was not approved`,
      body: decision === "REJECTED" ? (note ?? "No reason given.") : null,
      href: `/library/material/${material.id}`,
    });
  }

  await broadcastLibraryStats();

  return material;
}

/** Soft-delete (restorable) or hard-delete a material. */
export async function deleteMaterial(
  id: string,
  actor: ActorContext & { role?: string | null },
  options: { hard?: boolean } = {},
) {
  const existing = await prisma.material.findUnique({ where: { id } });

  if (!existing) throw new UserServiceError("That material no longer exists.", 404);

  if (!canEditMaterial({ id: actor.actorId, role: actor.role }, existing)) {
    throw new UserServiceError("You can only delete your own uploads.", 403);
  }

  if (options.hard && !canModerate(actor.role)) {
    throw new UserServiceError("Only administrators can permanently delete.", 403);
  }

  if (options.hard) {
    await prisma.material.delete({ where: { id } });

    /*
     * Remove the bytes too.
     *
     * This used to be left to the caller — the return value carried
     * `storageKey` and a comment saying the caller "may want to clean up the
     * stored file". No caller ever did, so a permanent delete removed the row
     * and left the file on the volume for ever. On a library measured in tens
     * of gigabytes that is how a disk fills up with material nobody can see,
     * reach, or account for.
     *
     * Best effort: the row is already gone, so a failure here must not turn a
     * completed delete into an error. It is logged instead, and
     * `measureDiskUsage` in quota.ts is what surfaces the leftovers.
     */
    if (existing.storageKey) {
      await removeFile(existing.storageKey).catch((error) => {
        console.error("[library] deleted material but could not remove its file", id, error);
      });
    }
  } else {
    await prisma.material.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  emitRealtime("material:deleted", {
    id,
    folderId: existing.folderId,
    title: existing.title,
  });

  await refreshFolderCount(existing.folderId);
  await broadcastLibraryStats();

  await recordAuditLog({
    actorId: actor.actorId,
    action: "DELETE",
    entity: "BOOK",
    entityId: id,
    message: `${options.hard ? "Permanently deleted" : "Deleted"} material "${existing.title}"`,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  /*
   * The storage key is deliberately NOT returned any more.
   *
   * It used to be, and the route spread the result straight into its JSON —
   * so a permanent delete answered with the file's internal on-disk path. That
   * is the one value the rest of this module goes out of its way to keep
   * server-side (see the note on `toRealtimeMaterial`), handed to the client by
   * the one function that had no reason to.
   */
  return { id, hard: Boolean(options.hard) };
}

/**
 * Reclaim the space held by materials that were deleted a while ago.
 *
 * A soft delete keeps the row — the audit trail should still make sense — and
 * keeps the file, because a soft delete is meant to be reversible. Nothing
 * reverses one today, so without this the bytes are unreachable and permanent:
 * the library reports free space it does not have, and the volume fills with
 * material no page can show.
 *
 * `olderThanDays` is the grace period. Deleting something by accident and
 * noticing a week later is common; this is what makes that recoverable from a
 * backup rather than from nothing at all.
 *
 * @returns how many rows were purged and how many bytes came back
 */
export async function purgeDeletedMaterials(
  olderThanDays: number,
  actor: ActorContext & { role?: string | null },
) {
  if (!canModerate(actor.role)) {
    throw new UserServiceError("Only administrators can purge deleted materials.", 403);
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Math.max(0, olderThanDays));

  const rows = await prisma.material.findMany({
    where: { deletedAt: { not: null, lt: cutoff } },
    select: { id: true, storageKey: true, sizeBytes: true, title: true },
  });

  let bytes = 0;
  let purged = 0;

  for (const row of rows) {
    // File first, then the row. The other order can leave a row pointing at
    // nothing if the process dies between the two, which is the shape that
    // makes a library list materials that 404.
    if (row.storageKey) {
      await removeFile(row.storageKey).catch((error) => {
        console.error("[library] purge could not remove", row.storageKey, error);
      });
    }

    await prisma.material.delete({ where: { id: row.id } }).then(
      () => {
        purged += 1;
        bytes += row.sizeBytes;
      },
      (error) => console.error("[library] purge could not delete row", row.id, error),
    );
  }

  await recordAuditLog({
    actorId: actor.actorId,
    action: "DELETE",
    entity: "BOOK",
    message: `Purged ${purged} material(s) deleted more than ${olderThanDays} days ago`,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    metadata: { purged, bytes },
  });

  await broadcastLibraryStats();

  return { purged, bytes };
}

/** Restore a soft-deleted material. */
export async function restoreMaterial(id: string, actor: ActorContext & { role?: string | null }) {
  if (!canModerate(actor.role)) {
    throw new UserServiceError("Only administrators can restore materials.", 403);
  }

  const material = await prisma.material.update({
    where: { id },
    data: { deletedAt: null },
    include: MATERIAL_INCLUDE,
  });

  emitRealtime("material:created", toRealtimeMaterial(material));
  await refreshFolderCount(material.folderId);
  await broadcastLibraryStats();

  return material;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/** Persist a notification and push it to that user's socket room. */
export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  actorName?: string | null;
}) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      actorName: input.actorName ?? null,
    },
  });

  emitRealtime("notification:new", {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    href: notification.href,
    actorName: notification.actorName,
    createdAt: notification.createdAt.toISOString(),
  });

  return notification;
}

/**
 * Announce a new upload.
 *
 * Deliberately *not* one `Notification` row per user: that is an O(users) write
 * on every upload and would dominate the database for a purely transient
 * banner. The live toast is the `material:created` broadcast that every client
 * in the library room already receives; persisted rows are reserved for
 * messages addressed to one person (approval, rejection, comment replies).
 */
async function notifyUpload(
  material: { id: string; title: string; kind: string },
  uploaderName: string | null,
) {
  emitRealtime("notification:new", {
    id: `transient-${material.id}`,
    // Empty userId marks this as a broadcast toast rather than a stored row.
    userId: "",
    type: "MATERIAL_UPLOADED",
    title: "New material uploaded",
    body: material.title,
    href: `/library/material/${material.id}`,
    actorName: uploaderName,
    createdAt: new Date().toISOString(),
  });
}

/** Queue a review request for every moderator. */
async function notifyModeratorsOfPending(
  material: { id: string; title: string },
  uploaderName: string | null,
) {
  const moderators = await prisma.user.findMany({
    where: { role: { in: [...ADMIN_ROLES] }, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });

  await Promise.all(
    moderators.map((moderator) =>
      createNotification({
        userId: moderator.id,
        type: "MATERIAL_UPLOADED",
        title: "Upload awaiting approval",
        body: material.title,
        href: `/library/admin/pending`,
        actorName: uploaderName,
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getLibraryStats() {
  const base = { status: "APPROVED", deletedAt: null } as const;

  const [totalMaterials, pdfs, videos, handouts, references, pendingApprovals, totals] =
    await Promise.all([
      prisma.material.count({ where: base }),
      prisma.material.count({ where: { ...base, extension: "pdf" } }),
      prisma.material.count({ where: { ...base, kind: "VIDEO" } }),
      prisma.material.count({ where: { ...base, kind: "HANDOUT" } }),
      prisma.material.count({ where: { ...base, kind: "REFERENCE" } }),
      prisma.material.count({ where: { status: "PENDING", deletedAt: null } }),
      // One aggregate instead of two full-table scans.
      prisma.material.aggregate({
        where: base,
        _sum: { downloadCount: true, viewCount: true },
      }),
    ]);

  // How full the library is. Carried on the stats payload rather than behind
  // its own endpoint because it belongs beside the other library counters, and
  // because the tiles that show them are refreshed on every material change
  // anyway — which is exactly when the number moves.
  const storage = await getStorageUsage();

  return {
    totalMaterials,
    pdfs,
    videos,
    handouts,
    references,
    totalDownloads: totals._sum.downloadCount ?? 0,
    totalViews: totals._sum.viewCount ?? 0,
    pendingApprovals,
    storageUsedBytes: storage.usedBytes,
    storageCapacityBytes: storage.capacityBytes,
    storageFreeBytes: storage.freeBytes,
    storagePercentUsed: storage.percentUsed,
  };
}

export async function broadcastLibraryStats() {
  try {
    emitRealtime("library:stats", await getLibraryStats());
  } catch (error) {
    console.error("[library] failed to broadcast stats", error);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Trim, lower-case, drop empties, de-duplicate, cap at 15. */
export function normalizeTags(tags?: string[] | null): string[] {
  if (!tags?.length) return [];

  const seen = new Set<string>();

  for (const raw of tags) {
    const tag = String(raw).trim().toLowerCase().slice(0, 40);
    if (tag) seen.add(tag);
    if (seen.size >= 15) break;
  }

  return [...seen];
}

export { parseTags };
