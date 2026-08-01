/**
 * DELETE /api/chat/messages/[id] — remove a message.
 *
 * The author may remove their own; faculty and above may remove any. The rule
 * lives in `deleteMessage`, so it holds for every caller.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { verifyCsrf, csrfError } from "@/lib/security";
import { deleteMessage } from "@/lib/chat";
import { UserServiceError } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/chat/messages/[id]">) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  const { id } = await ctx.params;

  try {
    return NextResponse.json(
      await deleteMessage(id, { id: auth.user.id, role: auth.user.role }),
    );
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/chat/messages/:id] DELETE", error);
    return NextResponse.json({ message: "Could not remove that message." }, { status: 500 });
  }
}
