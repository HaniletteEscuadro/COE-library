-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN "org" TEXT;

-- CreateIndex
CREATE INDEX "Announcement_org_publishedAt_idx" ON "Announcement"("org", "publishedAt");
