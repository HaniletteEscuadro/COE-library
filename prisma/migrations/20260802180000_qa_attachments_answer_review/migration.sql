-- Question attachments.
--
-- Added with ALTER TABLE rather than a table rebuild: every column is nullable
-- or has a default, so existing rows are valid as they stand and nothing has to
-- be copied.
ALTER TABLE "Question" ADD COLUMN "attachmentKey" TEXT;
ALTER TABLE "Question" ADD COLUMN "attachmentName" TEXT;
ALTER TABLE "Question" ADD COLUMN "attachmentMime" TEXT;
ALTER TABLE "Question" ADD COLUMN "attachmentSize" INTEGER NOT NULL DEFAULT 0;

-- Answer attachments.
ALTER TABLE "Answer" ADD COLUMN "attachmentKey" TEXT;
ALTER TABLE "Answer" ADD COLUMN "attachmentName" TEXT;
ALTER TABLE "Answer" ADD COLUMN "attachmentMime" TEXT;
ALTER TABLE "Answer" ADD COLUMN "attachmentSize" INTEGER NOT NULL DEFAULT 0;

-- Answer review.
--
-- DEFAULT 'APPROVED' is what makes this migration safe on a database that
-- already holds answers: until now only staff could answer, so every existing
-- row is one that was always meant to be public. A default of 'PENDING' would
-- silently unpublish the entire answer history.
ALTER TABLE "Answer" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "Answer" ADD COLUMN "rejectionNote" TEXT;
ALTER TABLE "Answer" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "Answer" ADD COLUMN "reviewedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Answer_reviewStatus_createdAt_idx" ON "Answer"("reviewStatus", "createdAt");
