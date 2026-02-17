-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "theme" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AlterTable Item: add userId (nullable first for backfill)
ALTER TABLE "Item" ADD COLUMN "userId" TEXT;

-- AlterTable Task: add userId
ALTER TABLE "Task" ADD COLUMN "userId" TEXT;

-- AlterTable Project: add userId
ALTER TABLE "Project" ADD COLUMN "userId" TEXT;

-- AlterTable CalendarSource: add userId
ALTER TABLE "CalendarSource" ADD COLUMN "userId" TEXT;

-- AlterTable ReviewSession: add userId
ALTER TABLE "ReviewSession" ADD COLUMN "userId" TEXT;

-- AlterTable TransitionAuditLog: add userId (optional)
ALTER TABLE "TransitionAuditLog" ADD COLUMN "userId" TEXT;

-- Backfill: create a default user and assign all existing rows to it (if any)
INSERT INTO "User" ("id", "email", "passwordHash", "name", "createdAt", "updatedAt")
SELECT 'clmigrationuser00000000000', 'migrated@local.dev', '', 'Migrated User', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "User" LIMIT 1);

UPDATE "Item" SET "userId" = (SELECT "id" FROM "User" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Task" SET "userId" = (SELECT "id" FROM "User" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Project" SET "userId" = (SELECT "id" FROM "User" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "CalendarSource" SET "userId" = (SELECT "id" FROM "User" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "ReviewSession" SET "userId" = (SELECT "id" FROM "User" LIMIT 1) WHERE "userId" IS NULL;

-- Make columns NOT NULL and add FKs
ALTER TABLE "Item" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Task" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "CalendarSource" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "ReviewSession" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "Item" ADD CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarSource" ADD CONSTRAINT "CalendarSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewSession" ADD CONSTRAINT "ReviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransitionAuditLog" ADD CONSTRAINT "TransitionAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Item_userId_idx" ON "Item"("userId");
CREATE INDEX "Item_userId_state_idx" ON "Item"("userId", "state");
CREATE INDEX "Task_userId_idx" ON "Task"("userId");
CREATE INDEX "Project_userId_idx" ON "Project"("userId");
CREATE INDEX "CalendarSource_userId_idx" ON "CalendarSource"("userId");
CREATE INDEX "ReviewSession_userId_idx" ON "ReviewSession"("userId");
