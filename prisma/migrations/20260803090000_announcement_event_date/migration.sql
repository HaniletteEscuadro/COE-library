-- The day a notice is about, separate from when it was posted and from when
-- it expires. Nullable, so every existing row stays valid: those were posted
-- before the portal had anywhere to send the date, and they have none.
ALTER TABLE "Announcement" ADD COLUMN "eventDate" TEXT;
