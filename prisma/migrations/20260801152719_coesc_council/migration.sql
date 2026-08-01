-- CreateTable
CREATE TABLE "CouncilOfficer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "position" TEXT NOT NULL,
    "positionLabel" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "course" TEXT,
    "photoKey" TEXT,
    "photoMimeType" TEXT,
    "photoSize" INTEGER NOT NULL DEFAULT 0,
    "photoUpdatedAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CouncilOfficer_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommitteeApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicantId" TEXT NOT NULL,
    "committee" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "yearLevel" TEXT NOT NULL,
    "contact" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CommitteeApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommitteeApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CouncilOfficer_position_key" ON "CouncilOfficer"("position");

-- CreateIndex
CREATE INDEX "CouncilOfficer_sortOrder_idx" ON "CouncilOfficer"("sortOrder");

-- CreateIndex
CREATE INDEX "CommitteeApplication_status_createdAt_idx" ON "CommitteeApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CommitteeApplication_applicantId_createdAt_idx" ON "CommitteeApplication"("applicantId", "createdAt");

-- CreateIndex
CREATE INDEX "CommitteeApplication_committee_status_idx" ON "CommitteeApplication"("committee", "status");
