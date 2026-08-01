/**
 * GET  /api/library/materials/[id] — full detail + the viewer's own flags
 * POST /api/library/materials/[id] — one interaction, chosen by `action`
 *
 * The interactions are collapsed into a single endpoint rather than seven
 * near-identical routes. They share the same auth, CSRF and material lookup,
 * and the only thing that varies is one service call — splitting them would be
 * six copies of the same twenty lines.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { deleteMaterial, getMaterial, reviewMaterial, updateMaterial } from "@/lib/library";
import {
  getViewerFlags,
  rateMaterial,
  recordView,
  removeBookmark,
  reportMaterial,
  toggleFavorite,
  toggleLike,
  upsertBookmark,
} from "@/lib/library-social";
import { UserServiceError } from "@/lib/users";
import { parseTags } from "@/lib/realtime";
import {
  bookmarkSchema,
  formatZodError,
  materialReviewSchema,
  materialUpdateSchema,
  ratingSchema,
  reportSchema,
} from "@/lib/validation";
import { verifyCsrf, csrfError, getIpFromHeaders, getUserAgentFromHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/library/materials/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const material = await getMaterial(id);

  if (!material) {
    return NextResponse.json({ message: "That material is not available." }, { status: 404 });
  }

  const flags = await getViewerFlags(auth.user.id, [material.id]);

  // Explicit shape — `storageKey` must never reach the browser.
  return NextResponse.json({
    material: {
      id: material.id,
      folderId: material.folderId,
      folderPath: material.folder?.path ?? "",
      title: material.title,
      description: material.description,
      kind: material.kind,
      mimeType: material.mimeType,
      extension: material.extension,
      sizeBytes: material.sizeBytes,
      externalUrl: material.externalUrl,
      course: material.course,
      year: material.year,
      subject: material.subject,
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
      ratingCount: material.ratingCount,
      uploadedByName: material.uploadedBy?.name ?? material.uploadedBy?.username ?? null,
      createdAt: material.createdAt.toISOString(),
      likedByMe: flags.liked.has(material.id),
      favoritedByMe: flags.favorited.has(material.id),
      bookmarkedByMe: flags.bookmarked.has(material.id),
    },
  });
}

/**
 * PATCH /api/library/materials/[id] — rename or re-file a material.
 * DELETE /api/library/materials/[id] — remove one.
 *
 * Both existed in the service layer (`updateMaterial`, `deleteMaterial`) and in
 * the portal's UI, which has had Rename and Delete buttons all along — but
 * there was no route between them. The buttons edited this browser's cache and
 * nothing else, so a "deleted" file reappeared on the next sync and everybody
 * else went on seeing it the whole time.
 *
 * Who may: an administrator, or the person who uploaded it. That is
 * `canEditMaterial`, the same rule the service already enforces, and the same
 * shape as deleting your own question or your own chat message.
 *
 * Deletion is soft by default — `deletedAt` is set, the row and its file stay.
 * `?hard=true` removes the row outright and is restricted to moderators, so an
 * uploader can retract a mistake but cannot destroy history.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/library/materials/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const parsed = materialUpdateSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  try {
    const material = await updateMaterial(id, parsed.data, {
      actorId: auth.user.id,
      actorName: auth.user.name ?? auth.user.username,
      role: auth.user.role,
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    });

    return NextResponse.json({ message: "Saved.", material });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message, field: error.field }, { status: error.status });
    }

    console.error("[api/library/materials/:id PATCH]", error);
    return NextResponse.json({ message: "Could not save that change." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/library/materials/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  const { id } = await ctx.params;
  const hard = new URL(request.url).searchParams.get("hard") === "true";

  try {
    const result = await deleteMaterial(
      id,
      {
        actorId: auth.user.id,
        actorName: auth.user.name ?? auth.user.username,
        role: auth.user.role,
        ipAddress: getIpFromHeaders(request.headers),
        userAgent: getUserAgentFromHeaders(request.headers),
      },
      { hard },
    );

    return NextResponse.json({ message: "Removed.", ...result });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message, field: error.field }, { status: error.status });
    }

    console.error("[api/library/materials/:id DELETE]", error);
    return NextResponse.json({ message: "Could not remove that material." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/library/materials/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: { action?: string; [key: string]: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const action = String(body.action ?? "");
  const userId = auth.user.id;

  // `view` is fired on every open and is not state the user chose, so it is
  // exempt from CSRF. Everything else is a deliberate write.
  if (action !== "view" && !verifyCsrf(request)) {
    return csrfError();
  }

  try {
    switch (action) {
      case "like":
        return NextResponse.json(await toggleLike(id, userId));

      case "favorite":
        return NextResponse.json(await toggleFavorite(id, userId));

      case "bookmark": {
        const parsed = bookmarkSchema.safeParse(body);
        if (!parsed.success) {
          const { message, fieldErrors } = formatZodError(parsed.error);
          return NextResponse.json({ message, fieldErrors }, { status: 400 });
        }
        await upsertBookmark(id, userId, parsed.data);
        return NextResponse.json({ bookmarked: true });
      }

      case "unbookmark":
        return NextResponse.json(await removeBookmark(id, userId));

      case "view":
        return NextResponse.json(
          await recordView(id, { userId, ipAddress: getIpFromHeaders(request.headers) }),
        );

      case "rate": {
        const parsed = ratingSchema.safeParse(body);
        if (!parsed.success) {
          const { message, fieldErrors } = formatZodError(parsed.error);
          return NextResponse.json({ message, fieldErrors }, { status: 400 });
        }
        return NextResponse.json(await rateMaterial(id, userId, parsed.data.score));
      }

      case "report": {
        const parsed = reportSchema.safeParse(body);
        if (!parsed.success) {
          const { message, fieldErrors } = formatZodError(parsed.error);
          return NextResponse.json({ message, fieldErrors }, { status: 400 });
        }
        await reportMaterial(id, userId, parsed.data);
        return NextResponse.json({ message: "Reported. An administrator will review it." });
      }

      // --- Moderation ---------------------------------------------------
      //
      // Uploads from students land in PENDING and are deliberately not
      // broadcast, so without this there is no way for one ever to reach the
      // library. `reviewMaterial` owns the permission check and, on approval,
      // emits `material:created` — which is what makes a queued upload appear
      // on everyone's screen the moment it is published.
      case "review": {
        const parsed = materialReviewSchema.safeParse(body);
        if (!parsed.success) {
          const { message, fieldErrors } = formatZodError(parsed.error);
          return NextResponse.json({ message, fieldErrors }, { status: 400 });
        }

        const reviewed = await reviewMaterial(id, parsed.data.decision, parsed.data.note, {
          actorId: userId,
          role: auth.user.role,
          ipAddress: getIpFromHeaders(request.headers),
          userAgent: getUserAgentFromHeaders(request.headers),
        });

        return NextResponse.json({
          message:
            parsed.data.decision === "APPROVED"
              ? `"${reviewed.title}" is now in the library.`
              : `"${reviewed.title}" was rejected.`,
          status: reviewed.status,
        });
      }

      default:
        return NextResponse.json(
          {
            message: "Unknown action.",
            allowed: ["like", "favorite", "bookmark", "unbookmark", "view", "rate", "report", "review"],
          },
          { status: 400 },
        );
    }
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message, field: error.field }, { status: error.status });
    }

    console.error(`[api/library/materials/:id] ${action}`, error, getUserAgentFromHeaders(request.headers));
    return NextResponse.json({ message: "Could not complete that action." }, { status: 500 });
  }
}
