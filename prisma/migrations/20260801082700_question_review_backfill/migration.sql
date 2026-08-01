-- Backfill: every question that existed before moderation was introduced was
-- already visible on the board, so it stays visible.
--
-- The previous migration added `reviewStatus` with DEFAULT 'PENDING', which is
-- right for new questions and wrong for old ones — without this, adding
-- moderation would silently unpublish the entire existing board.
--
-- Scoped to rows created before this migration by using the reviewedAt column
-- being null together with the default value, so re-running is harmless.
UPDATE "Question"
SET "reviewStatus" = 'APPROVED',
    "reviewedAt" = CURRENT_TIMESTAMP
WHERE "reviewStatus" = 'PENDING'
  AND "reviewedAt" IS NULL;
