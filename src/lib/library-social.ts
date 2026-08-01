/**
 * Engineering Library — social interactions.
 *
 * Likes, favourites, bookmarks, views, downloads, comments, ratings, reports.
 * Split out of `library.ts` so that file stays focused on folders and
 * materials.
 *
 * Two rules run through everything here:
 *
 *   1. **The unique constraint is the guarantee, not the UI.** Every toggle is
 *      backed by a `@@unique([materialId, userId])` index, so a double-clicked
 *      button or a replayed request cannot inflate a counter.
 *   2. **Counters and detail rows move together.** Each interaction writes its
 *      audit row and adjusts the denormalised counter inside one transaction,
 *      so the two can never disagree.
 */

import { prisma } from "@/lib/prisma";
import { emitRealtime } from "@/lib/realtime";
import { parseUserAgent } from "@/lib/device";
import { UserServiceError } from "@/lib/users";
import { createNotification } from "@/lib/library";

/** Views from the same user are only counted once per this window. */
const VIEW_DEDUPE_MS = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// Counter broadcasting
// ---------------------------------------------------------------------------

/**
 * Push the current counters for one material.
 *
 * A narrow event rather than re-broadcasting the whole material: a like should
 * not cause every open client to re-render the entire card.
 */
async function broadcastCounts(materialId: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: {
      id: true,
      viewCount: true,
      downloadCount: true,
      likeCount: true,
      commentCount: true,
      ratingSum: true,
      ratingCount: true,
    },
  });

  if (!material) return;

  emitRealtime("material:counts", {
    id: material.id,
    viewCount: material.viewCount,
    downloadCount: material.downloadCount,
    likeCount: material.likeCount,
    commentCount: material.commentCount,
    ratingAverage:
      material.ratingCount > 0
        ? Math.round((material.ratingSum / material.ratingCount) * 10) / 10
        : 0,
  });
}

/** Ensure the material exists and is visible before interacting with it. */
async function requireVisibleMaterial(materialId: string) {
  const material = await prisma.material.findFirst({
    where: { id: materialId, deletedAt: null, status: "APPROVED" },
    select: { id: true, title: true, uploadedById: true, storageKey: true, originalName: true, mimeType: true },
  });

  if (!material) {
    throw new UserServiceError("That material is not available.", 404);
  }

  return material;
}

// ---------------------------------------------------------------------------
// Likes / favourites
// ---------------------------------------------------------------------------

/**
 * Toggle a like. Returns the resulting state so the client can settle its
 * optimistic update rather than guessing.
 */
export async function toggleLike(materialId: string, userId: string) {
  await requireVisibleMaterial(materialId);

  const existing = await prisma.materialLike.findUnique({
    where: { materialId_userId: { materialId, userId } },
  });

  const liked = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.materialLike.delete({ where: { id: existing.id } });
      await tx.material.update({
        where: { id: materialId },
        data: { likeCount: { decrement: 1 } },
      });
      return false;
    }

    await tx.materialLike.create({ data: { materialId, userId } });
    await tx.material.update({
      where: { id: materialId },
      data: { likeCount: { increment: 1 } },
    });
    return true;
  });

  await broadcastCounts(materialId);

  return { liked };
}

export async function toggleFavorite(materialId: string, userId: string) {
  await requireVisibleMaterial(materialId);

  const existing = await prisma.materialFavorite.findUnique({
    where: { materialId_userId: { materialId, userId } },
  });

  if (existing) {
    await prisma.materialFavorite.delete({ where: { id: existing.id } });
    return { favorited: false };
  }

  await prisma.materialFavorite.create({ data: { materialId, userId } });
  return { favorited: true };
}

/**
 * Create or update a bookmark. Also the "Continue Reading" write path — passing
 * `progress`/`lastPage` on each read records where the user got to.
 */
export async function upsertBookmark(
  materialId: string,
  userId: string,
  input: { note?: string; lastPage?: number; progress?: number } = {},
) {
  await requireVisibleMaterial(materialId);

  const progress =
    input.progress === undefined ? undefined : Math.max(0, Math.min(100, Math.round(input.progress)));

  return prisma.materialBookmark.upsert({
    where: { materialId_userId: { materialId, userId } },
    create: {
      materialId,
      userId,
      note: input.note ?? null,
      lastPage: input.lastPage ?? null,
      progress: progress ?? 0,
    },
    update: {
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.lastPage !== undefined ? { lastPage: input.lastPage } : {}),
      ...(progress !== undefined ? { progress } : {}),
    },
  });
}

export async function removeBookmark(materialId: string, userId: string) {
  await prisma.materialBookmark
    .delete({ where: { materialId_userId: { materialId, userId } } })
    .catch(() => {
      /* already gone — deleting twice is not an error */
    });

  return { bookmarked: false };
}

// ---------------------------------------------------------------------------
// Views / downloads
// ---------------------------------------------------------------------------

/**
 * Record a view.
 *
 * De-duplicated per user over `VIEW_DEDUPE_MS`. Without this, a student paging
 * back and forth inflates the count and corrupts the "Most Viewed" sort — the
 * counter is meant to measure interest, not scroll behaviour.
 */
export async function recordView(
  materialId: string,
  viewer: { userId?: string | null; ipAddress?: string | null },
) {
  await requireVisibleMaterial(materialId);

  if (viewer.userId) {
    const recent = await prisma.materialView.findFirst({
      where: {
        materialId,
        userId: viewer.userId,
        createdAt: { gte: new Date(Date.now() - VIEW_DEDUPE_MS) },
      },
      select: { id: true },
    });

    // Still refresh "recently viewed" ordering, but do not double-count.
    if (recent) {
      await prisma.materialView.update({
        where: { id: recent.id },
        data: { createdAt: new Date() },
      });
      return { counted: false };
    }
  }

  await prisma.$transaction([
    prisma.materialView.create({
      data: {
        materialId,
        userId: viewer.userId ?? null,
        ipAddress: viewer.ipAddress ?? null,
      },
    }),
    prisma.material.update({
      where: { id: materialId },
      data: { viewCount: { increment: 1 } },
    }),
  ]);

  await broadcastCounts(materialId);

  return { counted: true };
}

/**
 * Record a download and return what the route needs to stream the file.
 *
 * Downloads are *not* de-duplicated: each one is a real retrieval and the
 * detail rows are an audit trail admins are expected to be able to inspect.
 */
export async function recordDownload(
  materialId: string,
  downloader: { userId?: string | null; ipAddress?: string | null; userAgent?: string | null },
) {
  const material = await requireVisibleMaterial(materialId);
  const { device, browser, os } = parseUserAgent(downloader.userAgent);

  await prisma.$transaction([
    prisma.materialDownload.create({
      data: {
        materialId,
        userId: downloader.userId ?? null,
        ipAddress: downloader.ipAddress ?? null,
        device,
        browser,
        os,
      },
    }),
    prisma.material.update({
      where: { id: materialId },
      data: { downloadCount: { increment: 1 } },
    }),
  ]);

  await broadcastCounts(materialId);

  return {
    storageKey: material.storageKey,
    originalName: material.originalName,
    mimeType: material.mimeType,
  };
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/**
 * Post a comment or a reply.
 *
 * `body` is stored verbatim. It is escaped at render time, never sanitised on
 * the way in — sanitising on input destroys the original text and still fails
 * the moment one render path forgets to escape. Escaping on output is the
 * property that actually holds.
 */
export async function addComment(
  materialId: string,
  authorId: string,
  input: { body: string; parentId?: string | null },
) {
  const material = await requireVisibleMaterial(materialId);

  const body = input.body.trim();

  if (!body) throw new UserServiceError("Write something first.", 400, "body");
  if (body.length > 2000) throw new UserServiceError("Comments are limited to 2000 characters.", 400, "body");

  // A reply must belong to the same material, or a crafted request could graft
  // a reply onto an unrelated thread.
  if (input.parentId) {
    const parent = await prisma.materialComment.findFirst({
      where: { id: input.parentId, materialId, deletedAt: null },
      select: { id: true, authorId: true },
    });

    if (!parent) throw new UserServiceError("That comment no longer exists.", 404);
  }

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.materialComment.create({
      data: { materialId, authorId, body, parentId: input.parentId ?? null },
      include: { author: { select: { id: true, name: true, username: true, image: true } } },
    });

    await tx.material.update({
      where: { id: materialId },
      data: { commentCount: { increment: 1 } },
    });

    return created;
  });

  await broadcastCounts(materialId);

  // Notify the parent comment's author on a reply, or the uploader on a
  // top-level comment. Never notify someone about their own action.
  const notifyTargetId = input.parentId
    ? (
        await prisma.materialComment.findUnique({
          where: { id: input.parentId },
          select: { authorId: true },
        })
      )?.authorId
    : material.uploadedById;

  if (notifyTargetId && notifyTargetId !== authorId) {
    await createNotification({
      userId: notifyTargetId,
      type: "COMMENT_REPLY",
      title: input.parentId ? "New reply to your comment" : `New comment on "${material.title}"`,
      body: body.slice(0, 140),
      href: `/library/material/${materialId}`,
      actorName: comment.author?.name ?? comment.author?.username ?? null,
    });
  }

  return comment;
}

/** Threaded comments for a material, newest root first. */
export async function listComments(materialId: string, viewerId?: string | null) {
  const comments = await prisma.materialComment.findMany({
    where: { materialId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, username: true, image: true, role: true } },
      // Only the viewer's own like, so the UI knows whether to fill the icon.
      likes: viewerId ? { where: { userId: viewerId }, select: { id: true } } : false,
    },
  });

  type Node = (typeof comments)[number] & { likedByMe: boolean; replies: Node[] };

  const byId = new Map<string, Node>();
  for (const comment of comments) {
    byId.set(comment.id, {
      ...comment,
      likedByMe: Array.isArray(comment.likes) && comment.likes.length > 0,
      replies: [],
    });
  }

  const roots: Node[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : null;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }

  // Newest thread first, but replies within a thread read oldest-first.
  roots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return roots;
}

/** Soft-delete a comment. Author or moderator only. */
export async function deleteComment(
  commentId: string,
  actor: { id: string; role?: string | null },
  canModerate: boolean,
) {
  const comment = await prisma.materialComment.findFirst({
    where: { id: commentId, deletedAt: null },
  });

  if (!comment) throw new UserServiceError("That comment no longer exists.", 404);

  if (comment.authorId !== actor.id && !canModerate) {
    throw new UserServiceError("You can only delete your own comments.", 403);
  }

  await prisma.$transaction([
    prisma.materialComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    }),
    prisma.material.update({
      where: { id: comment.materialId },
      data: { commentCount: { decrement: 1 } },
    }),
  ]);

  await broadcastCounts(comment.materialId);

  return { id: commentId };
}

export async function toggleCommentLike(commentId: string, userId: string) {
  const existing = await prisma.materialCommentLike.findUnique({
    where: { commentId_userId: { commentId, userId } },
  });

  const liked = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.materialCommentLike.delete({ where: { id: existing.id } });
      await tx.materialComment.update({
        where: { id: commentId },
        data: { likeCount: { decrement: 1 } },
      });
      return false;
    }

    await tx.materialCommentLike.create({ data: { commentId, userId } });
    await tx.materialComment.update({
      where: { id: commentId },
      data: { likeCount: { increment: 1 } },
    });
    return true;
  });

  return { liked };
}

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

/**
 * Rate 1-5.
 *
 * `ratingSum`/`ratingCount` are maintained rather than an average column, so
 * changing an existing rating adjusts the sum by the delta instead of
 * recomputing an average over every row.
 */
export async function rateMaterial(materialId: string, userId: string, score: number) {
  await requireVisibleMaterial(materialId);

  const value = Math.round(score);

  if (!Number.isFinite(value) || value < 1 || value > 5) {
    throw new UserServiceError("Ratings must be between 1 and 5.", 400, "score");
  }

  const existing = await prisma.materialRating.findUnique({
    where: { materialId_userId: { materialId, userId } },
  });

  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.materialRating.update({
        where: { id: existing.id },
        data: { score: value },
      });
      await tx.material.update({
        where: { id: materialId },
        // Only the difference — the count is unchanged.
        data: { ratingSum: { increment: value - existing.score } },
      });
      return;
    }

    await tx.materialRating.create({ data: { materialId, userId, score: value } });
    await tx.material.update({
      where: { id: materialId },
      data: { ratingSum: { increment: value }, ratingCount: { increment: 1 } },
    });
  });

  await broadcastCounts(materialId);

  return { score: value };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/** "Report broken file" and similar. Notifies moderators. */
export async function reportMaterial(
  materialId: string,
  reporterId: string,
  input: { reason: string; details?: string },
) {
  const material = await requireVisibleMaterial(materialId);

  const report = await prisma.materialReport.create({
    data: {
      materialId,
      reporterId,
      reason: input.reason,
      details: input.details?.trim() || null,
    },
  });

  const moderators = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "REGISTRAR"] }, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });

  await Promise.all(
    moderators.map((moderator) =>
      createNotification({
        userId: moderator.id,
        type: "MATERIAL_REPORTED",
        title: `Reported: "${material.title}"`,
        body: input.reason,
        href: `/library/material/${materialId}`,
      }),
    ),
  );

  return report;
}

// ---------------------------------------------------------------------------
// Personalised reads
// ---------------------------------------------------------------------------

/**
 * The viewer's own flags for a set of materials, as three Sets.
 *
 * Fetched in one batched query per relation rather than per card — rendering a
 * 24-card grid would otherwise issue 72 queries.
 */
export async function getViewerFlags(userId: string, materialIds: string[]) {
  if (materialIds.length === 0) {
    return { liked: new Set<string>(), favorited: new Set<string>(), bookmarked: new Set<string>() };
  }

  const [likes, favorites, bookmarks] = await Promise.all([
    prisma.materialLike.findMany({
      where: { userId, materialId: { in: materialIds } },
      select: { materialId: true },
    }),
    prisma.materialFavorite.findMany({
      where: { userId, materialId: { in: materialIds } },
      select: { materialId: true },
    }),
    prisma.materialBookmark.findMany({
      where: { userId, materialId: { in: materialIds } },
      select: { materialId: true },
    }),
  ]);

  return {
    liked: new Set(likes.map((row) => row.materialId)),
    favorited: new Set(favorites.map((row) => row.materialId)),
    bookmarked: new Set(bookmarks.map((row) => row.materialId)),
  };
}

/** "Continue Reading" — bookmarks with partial progress, most recent first. */
export async function getContinueReading(userId: string, take = 8) {
  return prisma.materialBookmark.findMany({
    where: {
      userId,
      progress: { gt: 0, lt: 100 },
      material: { deletedAt: null, status: "APPROVED" },
    },
    orderBy: { updatedAt: "desc" },
    take,
    include: {
      material: {
        include: {
          folder: { select: { path: true, name: true } },
          uploadedBy: { select: { name: true, username: true } },
        },
      },
    },
  });
}

/** "Recently Viewed" — distinct materials, most recent first. */
export async function getRecentlyViewed(userId: string, take = 8) {
  const views = await prisma.materialView.findMany({
    where: { userId, material: { deletedAt: null, status: "APPROVED" } },
    orderBy: { createdAt: "desc" },
    // Over-fetch, then de-duplicate: SQLite has no DISTINCT ON.
    take: take * 4,
    include: {
      material: {
        include: {
          folder: { select: { path: true, name: true } },
          uploadedBy: { select: { name: true, username: true } },
        },
      },
    },
  });

  const seen = new Set<string>();
  const unique = [];

  for (const view of views) {
    if (seen.has(view.materialId)) continue;
    seen.add(view.materialId);
    unique.push(view.material);
    if (unique.length >= take) break;
  }

  return unique;
}

/** Unread notification list for the bell menu. */
export async function listNotifications(userId: string, options: { unreadOnly?: boolean } = {}) {
  return prisma.notification.findMany({
    where: { userId, ...(options.unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  const result = await prisma.notification.updateMany({
    // Scoped to `userId` so one user cannot mark another's notifications read.
    where: { userId, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });

  return { updated: result.count };
}
