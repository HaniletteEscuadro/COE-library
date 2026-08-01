-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "course" TEXT NOT NULL DEFAULT 'CE',
    "yearLevel" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "lesson" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Unanswered',
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

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "answererId" TEXT,
    "answererName" TEXT NOT NULL DEFAULT 'Anonymous Student',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "flagCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Answer_answererId_fkey" FOREIGN KEY ("answererId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnswerVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnswerVote_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnswerVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnswerComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "commenterId" TEXT,
    "commenterName" TEXT NOT NULL DEFAULT 'Anonymous Student',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "AnswerComment_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnswerComment_commenterId_fkey" FOREIGN KEY ("commenterId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QaFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT,
    "answerId" TEXT,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QaFlag_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QaFlag_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QaFlag_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Question_bestAnswerId_key" ON "Question"("bestAnswerId");

-- CreateIndex
CREATE INDEX "Question_deletedAt_createdAt_idx" ON "Question"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Question_course_yearLevel_subject_idx" ON "Question"("course", "yearLevel", "subject");

-- CreateIndex
CREATE INDEX "Question_status_createdAt_idx" ON "Question"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Question_askerId_idx" ON "Question"("askerId");

-- CreateIndex
CREATE INDEX "Question_subject_createdAt_idx" ON "Question"("subject", "createdAt");

-- CreateIndex
CREATE INDEX "Answer_questionId_deletedAt_idx" ON "Answer"("questionId", "deletedAt");

-- CreateIndex
CREATE INDEX "Answer_questionId_voteCount_idx" ON "Answer"("questionId", "voteCount");

-- CreateIndex
CREATE INDEX "Answer_answererId_idx" ON "Answer"("answererId");

-- CreateIndex
CREATE INDEX "Answer_verified_idx" ON "Answer"("verified");

-- CreateIndex
CREATE INDEX "AnswerVote_userId_idx" ON "AnswerVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerVote_answerId_userId_key" ON "AnswerVote"("answerId", "userId");

-- CreateIndex
CREATE INDEX "AnswerComment_answerId_createdAt_idx" ON "AnswerComment"("answerId", "createdAt");

-- CreateIndex
CREATE INDEX "AnswerComment_commenterId_idx" ON "AnswerComment"("commenterId");

-- CreateIndex
CREATE INDEX "QaFlag_reporterId_idx" ON "QaFlag"("reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "QaFlag_questionId_reporterId_key" ON "QaFlag"("questionId", "reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "QaFlag_answerId_reporterId_key" ON "QaFlag"("answerId", "reporterId");
