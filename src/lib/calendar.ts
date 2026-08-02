/**
 * Personal calendar entries.
 *
 * Every function here takes the viewer's own user id and scopes on it. That is
 * not defence in depth, it is the entire access model: there is no "read
 * someone else's calendar" path, not for an administrator either, because a
 * student's own plan for the week is not college business. The one thing the
 * calendar screen shows from other people is the announcement board, which is
 * public to every signed-in account anyway.
 *
 * Nothing here emits a realtime event. An entry belongs to one account, so
 * there is nobody to broadcast it to — and putting it on the shared socket
 * would push one student's plans at every open browser.
 */

import { prisma } from "@/lib/prisma";
import { UserServiceError } from "@/lib/users";

/** How many entries one account may hold. */
export const MAX_ENTRIES_PER_USER = 500;

/**
 * A day key, "YYYY-MM-DD".
 *
 * Validated rather than trusted: the column is a string, so a malformed value
 * would sort into the wrong place for ever and there is no database-level type
 * to catch it. The range check on month and day is what stops "2026-13-45".
 */
export function isDayKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Round-trip through Date to reject the 31st of a 30-day month, and Feb 30.
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export type CalendarEntryInput = {
  date: string;
  title: string;
  detail?: string | null;
};

function toClient(row: {
  id: string;
  date: string;
  title: string;
  detail: string | null;
  done: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    detail: row.detail ?? "",
    done: row.done,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * One account's entries.
 *
 * `from` exists so the calendar does not drag years of finished plans down the
 * wire every time it opens. It is a filter, not a retention rule — nothing is
 * deleted, and asking without it returns everything.
 */
export async function listCalendarEntries(userId: string, options?: { from?: string }) {
  const from = options?.from && isDayKey(options.from) ? options.from : null;

  const rows = await prisma.calendarEntry.findMany({
    where: {
      userId,
      // Lexicographic comparison is exactly chronological for "YYYY-MM-DD" —
      // which is the reason the column uses that format and no other.
      ...(from ? { date: { gte: from } } : {}),
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    take: MAX_ENTRIES_PER_USER,
  });

  return { entries: rows.map(toClient) };
}

export async function createCalendarEntry(userId: string, input: CalendarEntryInput) {
  if (!isDayKey(input.date)) {
    throw new UserServiceError("Pick a valid date.", 400, "date");
  }

  const title = input.title.trim();

  if (title.length < 2) {
    throw new UserServiceError("Give this plan a name.", 400, "title");
  }

  /*
   * A ceiling, so one account cannot fill the volume the whole college shares.
   * It is checked before the insert rather than enforced with a constraint
   * because the useful outcome is a message telling the student to clear some
   * out, not a failed write they cannot interpret.
   */
  const existing = await prisma.calendarEntry.count({ where: { userId } });

  if (existing >= MAX_ENTRIES_PER_USER) {
    throw new UserServiceError(
      `Your calendar is full (${MAX_ENTRIES_PER_USER} entries). Clear some out first.`,
      409,
    );
  }

  const row = await prisma.calendarEntry.create({
    data: {
      userId,
      date: input.date,
      title,
      detail: input.detail?.trim() || null,
    },
  });

  return toClient(row);
}

/** Tick one off, or un-tick it. */
export async function setCalendarEntryDone(userId: string, id: string, done: boolean) {
  // `updateMany` with the userId in the filter, rather than `update` by id:
  // this cannot touch another account's row even if the id is guessed, and it
  // reports zero rows instead of throwing a Prisma error we would have to map.
  const result = await prisma.calendarEntry.updateMany({
    where: { id, userId },
    data: { done },
  });

  if (result.count === 0) {
    throw new UserServiceError("That entry no longer exists.", 404);
  }

  return { id, done };
}

export async function deleteCalendarEntry(userId: string, id: string) {
  const result = await prisma.calendarEntry.deleteMany({ where: { id, userId } });

  if (result.count === 0) {
    throw new UserServiceError("That entry no longer exists.", 404);
  }

  return { id };
}

/**
 * Bulk clear, scoped to the caller.
 *
 * `past` is the one people actually want — "clear what is over with" — and it
 * is separated from `all` on purpose: a single Clear button that silently takes
 * next week's exam reminder with it is a button nobody presses twice.
 */
export async function clearCalendarEntries(
  userId: string,
  scope: "all" | "past" | "done",
  today: string,
) {
  const where =
    scope === "all"
      ? { userId }
      : scope === "done"
        ? { userId, done: true }
        : { userId, date: { lt: isDayKey(today) ? today : "0000-00-00" } };

  const result = await prisma.calendarEntry.deleteMany({ where });

  return { cleared: result.count };
}
