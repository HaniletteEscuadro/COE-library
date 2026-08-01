/**
 * GET    /api/library/materials/[id]/comments — threaded comments
 * POST   /api/library/materials/[id]/comments — post a comment or reply
 * DELETE /api/library/materials/[id]/comments — delete one (?commentId=)
 *
 * Comment bodies are stored and returned verbatim. They are escaped by React
 * at render time, never interpolated as HTML — sanitising on input would
 * mangle legitimate text and still fail the moment one render path forgot.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { canModerate } from "@/lib/library";
import { addComment, deleteComment, listComments, toggleCommentLike } from "@/lib/library-social";
import { UserServiceError } from "@/lib/users";
import { commentSchema, formatZodError } from "@/lib/validation";
import { verifyCsrf, csrfError } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/library/materials/[id]/comments">,
) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const roots = await listComments(id, auth.user.id);

    // Trim to what the UI needs; the raw rows carry join noise.
    const shape = (node: {
      id: string;
      body: string;
      likeCount: number;
      likedByMe: boolean;
      parentId: string | null;
      createdAt: Date;
      author?: { id: string; name: string | null; username: string | null; role: string } | null;
      replies: unknown[];
    }): unknown => ({
      id: node.id,
      body: node.body,
      likeCount: node.likeCount,
      likedByMe: node.likedByMe,
      parentId: node.parentId,
      createdAt: node.createdAt.toISOString(),
      authorId: node.author?.id ?? null,
      authorName: node.author?.name ?? node.author?.username ?? "Removed user",
      authorRole: node.author?.role ?? null,
      isMine: node.author?.id === auth.user.id,
      replies: (node.replies as Parameters<typeof shape>[0][]).map(shape),
    });

    return NextResponse.json({
      comments: roots.map((node) => shape(node as never)),
      canModerate: canModerate(auth.user.role),
    });
  } catch (error) {
    console.error("[api/library/comments] GET", error);
    return NextResponse.json({ message: "Could not load comments." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/library/materials/[id]/comments">,
) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  const { id } = await ctx.params;

  let body: { commentId?: string; action?: string; [key: string]: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  // Liking a comment shares this endpoint, keyed by `action`.
  if (body.action === "like" && typeof body.commentId === "string") {
    try {
      return NextResponse.json(await toggleCommentLike(body.commentId, auth.user.id));
    } catch (error) {
      console.error("[api/library/comments] like", error);
      return NextResponse.json({ message: "Could not like that comment." }, { status: 500 });
    }
  }

  const parsed = commentSchema.safeParse(body);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  try {
    const comment = await addComment(id, auth.user.id, {
      body: parsed.data.body,
      parentId: parsed.data.parentId ?? null,
    });

    return NextResponse.json(
      {
        message: "Posted.",
        comment: {
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          authorName: comment.author?.name ?? comment.author?.username ?? "You",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message, field: error.field }, { status: error.status });
    }

    console.error("[api/library/comments] POST", error);
    return NextResponse.json({ message: "Could not post the comment." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<"/api/library/materials/[id]/comments">,
) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  // Referenced so the typed context is used; the id lives on the comment.
  await ctx.params;

  const commentId = request.nextUrl.searchParams.get("commentId");

  if (!commentId) {
    return NextResponse.json({ message: "Missing commentId." }, { status: 400 });
  }

  try {
    // Ownership is checked inside the service — the flag only grants the
    // ability to delete someone else's.
    await deleteComment(commentId, { id: auth.user.id, role: auth.user.role }, canModerate(auth.user.role));
    return NextResponse.json({ message: "Comment deleted." });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/library/comments] DELETE", error);
    return NextResponse.json({ message: "Could not delete the comment." }, { status: 500 });
  }
}
