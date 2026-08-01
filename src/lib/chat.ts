/**
 * Live chat.
 *
 * The portal's chat panel used `BroadcastChannel` over a localStorage array,
 * which reaches other TABS of the same browser and nothing else — so two
 * students on two laptops each talked to an empty room and saw only their own
 * messages. These rows are shared, and every post is broadcast to the people
 * in that channel.
 *
 * THREE FIXED CHANNELS
 * --------------------
 * The portal ships three rooms — General, CE and EE — so they are created on
 * demand by slug rather than managed anywhere. `ensureChannels` is idempotent
 * and safe to call on every request.
 *
 * WHO SEES WHAT
 * -------------
 * General is open to every signed-in account. The two course rooms are for
 * that course, plus staff who need to reach both. That is the same rule the
 * page has always claimed — "Electrical Engineering only" — it simply was not
 * enforced anywhere before.
 */

import { prisma } from "@/lib/prisma";
import { UserServiceError } from "@/lib/users";
import { hasRole, ACADEMIC_STAFF_ROLES } from "@/lib/rbac";
import {
  CHAT_CHANNELS,
  canAccessChannel,
  channelsFor,
  emitRealtime,
} from "@/lib/realtime";

/*
 * The channel list and the access rule live in `lib/realtime.ts`.
 *
 * `server.ts` needs them at the socket handshake, and it cannot import this
 * file: the chain here reaches `lib/users.ts` -> `lib/security.ts` ->
 * `next/server`, which crashes the custom server on boot. `lib/realtime.ts`
 * imports nothing, so both sides can share it.
 *
 * Re-exported so callers of this module do not have to know that.
 */
export { CHAT_CHANNELS, canAccessChannel, channelsFor };

export type ChatChannelSlug = (typeof CHAT_CHANNELS)[number]["slug"];

export function isChatStaff(role: string | null | undefined) {
  return hasRole(role, ACADEMIC_STAFF_ROLES);
}

/**
 * Create the three rooms if they are missing, and return them by slug.
 *
 * `title` is the natural key — there is no slug column on ChatConversation, and
 * adding one would be a migration for three fixed rows.
 */
export async function ensureChannels() {
  const bySlug = new Map<string, { id: string; title: string }>();

  for (const channel of CHAT_CHANNELS) {
    let row = await prisma.chatConversation.findFirst({
      where: { title: channel.title, type: "CHANNEL" },
      select: { id: true, title: true },
    });

    if (!row) {
      try {
        row = await prisma.chatConversation.create({
          data: {
            title: channel.title,
            description: channel.description,
            type: "CHANNEL",
          },
          select: { id: true, title: true },
        });
      } catch {
        // Two requests raced to create the same room; read the winner's.
        row = await prisma.chatConversation.findFirst({
          where: { title: channel.title, type: "CHANNEL" },
          select: { id: true, title: true },
        });
      }
    }

    if (row) bySlug.set(channel.slug, row);
  }

  return bySlug;
}

async function requireChannel(slug: string) {
  const channels = await ensureChannels();
  const row = channels.get(slug);

  if (!row) {
    throw new UserServiceError("That chat room is not available.", 404);
  }

  return row;
}

type MessageRow = {
  id: string;
  conversationId: string;
  senderId: string | null;
  type: string;
  body: string | null;
  createdAt: Date;
  editedAt: Date | null;
  sender?: { id: string; name: string | null; username: string | null; role: string; image: string | null } | null;
};

/**
 * Wire shape.
 *
 * The sender is carried on every message — that is the whole "you can see who
 * said it" requirement, and deriving it client-side from an id would mean the
 * client needing the whole user table.
 */
export function toWireMessage(message: MessageRow, slug: string) {
  return {
    id: message.id,
    channel: slug,
    body: message.body ?? "",
    type: message.type,
    senderId: message.senderId,
    senderName: message.sender?.name ?? message.sender?.username ?? "COE user",
    senderUsername: message.sender?.username ?? "",
    senderRole: message.sender?.role ?? "USER",
    senderImage: message.sender?.image ?? null,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
  };
}

const SENDER_SELECT = { id: true, name: true, username: true, role: true, image: true } as const;

/** Newest `take` messages, returned oldest-first so the client can just append. */
export async function listMessages(
  slug: string,
  viewer: { role: string | null; discipline: string | null },
  options: { take?: number; before?: string } = {},
) {
  if (!canAccessChannel(slug, viewer)) {
    throw new UserServiceError("You do not have access to that chat room.", 403);
  }

  const channel = await requireChannel(slug);
  const take = Math.min(200, Math.max(1, options.take ?? 80));

  const rows = await prisma.chatMessage.findMany({
    where: {
      conversationId: channel.id,
      deletedAt: null,
      ...(options.before ? { createdAt: { lt: new Date(options.before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: { sender: { select: SENDER_SELECT } },
  });

  return {
    channel: slug,
    conversationId: channel.id,
    messages: rows.reverse().map((m) => toWireMessage(m, slug)),
  };
}

/** Post a message and broadcast it to everyone in the room. */
export async function postMessage(
  slug: string,
  body: string,
  actor: { id: string; role: string | null; discipline: string | null },
) {
  if (!canAccessChannel(slug, actor)) {
    throw new UserServiceError("You do not have access to that chat room.", 403);
  }

  const text = body.trim();

  if (!text) {
    throw new UserServiceError("Write a message first.", 400, "body");
  }

  const channel = await requireChannel(slug);

  const message = await prisma.chatMessage.create({
    data: {
      conversationId: channel.id,
      senderId: actor.id,
      type: "TEXT",
      body: text,
    },
    include: { sender: { select: SENDER_SELECT } },
  });

  // Keeps the room list ordered by recent activity without a scan.
  await prisma.chatConversation.update({
    where: { id: channel.id },
    data: { lastMessageAt: message.createdAt },
  });

  emitRealtime("chat:message", toWireMessage(message, slug));

  return message;
}

/**
 * Delete a message. The author may remove their own; staff may remove any.
 * Soft delete, so a moderation decision can be looked at afterwards.
 */
export async function deleteMessage(
  id: string,
  actor: { id: string; role: string | null },
) {
  const message = await prisma.chatMessage.findFirst({
    where: { id, deletedAt: null },
    include: { conversation: { select: { title: true } } },
  });

  if (!message) {
    throw new UserServiceError("That message no longer exists.", 404);
  }

  if (message.senderId !== actor.id && !isChatStaff(actor.role)) {
    throw new UserServiceError("Only the author, or a faculty member, can remove this.", 403);
  }

  await prisma.chatMessage.update({ where: { id }, data: { deletedAt: new Date() } });

  const slug =
    CHAT_CHANNELS.find((c) => c.title === message.conversation?.title)?.slug ?? "general";

  emitRealtime("chat:deleted", { id, channel: slug });

  return { id };
}
