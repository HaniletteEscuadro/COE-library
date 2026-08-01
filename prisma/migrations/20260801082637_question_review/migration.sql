-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "course" TEXT NOT NULL DEFAULT 'CE',
    "yearLevel" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "lesson" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Unanswered',
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "askerId" TEXT,
    "askerName" TEXT NOT NULL DEFAULT 'Anonymous Student',
    "bestAnswerId" TEXT,
    "answerCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "flagCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Question_askerId_fkey" FOREIGN KEY ("askerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("answerCount", "askerId", "askerName", "bestAnswerId", "course", "createdAt", "deletedAt", "description", "flagCount", "id", "lesson", "status", "subject", "tags", "title", "updatedAt", "viewCount", "yearLevel") SELECT "answerCount", "askerId", "askerName", "bestAnswerId", "course", "createdAt", "deletedAt", "description", "flagCount", "id", "lesson", "status", "subject", "tags", "title", "updatedAt", "viewCount", "yearLevel" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE UNIQUE INDEX "Question_bestAnswerId_key" ON "Question"("bestAnswerId");
CREATE INDEX "Question_deletedAt_createdAt_idx" ON "Question"("deletedAt", "createdAt");
CREATE INDEX "Question_course_yearLevel_subject_idx" ON "Question"("course", "yearLevel", "subject");
CREATE INDEX "Question_status_createdAt_idx" ON "Question"("status", "createdAt");
CREATE INDEX "Question_askerId_idx" ON "Question"("askerId");
CREATE INDEX "Question_subject_createdAt_idx" ON "Question"("subject", "createdAt");
CREATE INDEX "Question_reviewStatus_createdAt_idx" ON "Question"("reviewStatus", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
