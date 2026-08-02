-- CreateTable
CREATE TABLE "Concern" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "response" TEXT,
    "reviewedById" TEXT,
    "approvedAt" DATETIME,
    "addressedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Concern_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Concern_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Concern_deletedAt_status_createdAt_idx" ON "Concern"("deletedAt", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Concern_authorId_idx" ON "Concern"("authorId");

-- CreateIndex
CREATE INDEX "Concern_category_idx" ON "Concern"("category");
