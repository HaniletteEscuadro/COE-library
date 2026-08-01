/**
 * GET  /api/chat/messages?channel=general — recent messages in one room
 * POST /api/chat/messages                 — say something
 *
 * Both are gated on `canAccessChannel`, inside the service, so the rule holds
 * for any caller. The channel list itself comes back from GET with no channel
 * given, which is how the client learns which rooms it may open.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { verifyCsrf, csrfError } from "@/lib/security";
import { channelsFor, listMessages, postMessage } from "@/lib/chat";
import { UserServiceError } from "@/lib/users";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  channel: z.string().trim().max(24).optional(),
  take: z.coerce.number().int().min(1).max(200).optional().default(80),
  before: z.string().trim().max(40).optional(),
});

const postSchema = z.object({
  channel: z.string().trim().min(1).max(24),
  body: z.string().trim().min(1, "Write a message first.").max(4000, "That message is too long."),
});

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in to use the chat." }, { status: 401 });
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid query." },
      { status: 400 },
    );
  }

  const viewer = { role: auth.user.role, discipline: auth.user.discipline };
  const channels = channelsFor(viewer);

  // No channel asked for: just say which rooms are open to this account.
  if (!parsed.data.channel) {
    return NextResponse.json({ channels });
  }

  try {
    const result = await listMessages(parsed.data.channel, viewer, {
      take: parsed.data.take,
      before: parsed.data.before,
    });

    return NextResponse.json({ ...result, channels });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/chat/messages] GET", error);
    return NextResponse.json({ message: "Could not load the chat." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in to use the chat." }, { status: 401 });
  }

  if (!verifyCsrf(request)) return csrfError();

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Could not send that." },
      { status: 400 },
    );
  }

  try {
    const message = await postMessage(parsed.data.channel, parsed.data.body, {
      id: auth.user.id,
      role: auth.user.role,
      discipline: auth.user.discipline,
    });

    return NextResponse.json({ id: message.id }, { status: 201 });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("[api/chat/messages] POST", error);
    return NextResponse.json({ message: "Could not send that message." }, { status: 500 });
  }
}
