-- Initial schema: all Prisma models. Replaces incremental migrations that assumed tables existed.
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('task', 'project', 'reference', 'waiting', 'someday', 'trash');

-- CreateEnum
CREATE TYPE "ItemState" AS ENUM ('INBOX', 'CLARIFYING', 'ACTIONABLE', 'PROJECT', 'WAITING', 'SNOOZED', 'SOMEDAY', 'REFERENCE', 'DONE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContextTag" AS ENUM ('calls', 'errands', 'computer', 'deep_work');

-- CreateEnum
CREATE TYPE "EnergyLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('draft', 'email', 'decision', 'note', 'file');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('CLARIFYING', 'ACTIVE', 'WAITING', 'SOMEDAY', 'ON_HOLD', 'DONE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReviewSessionType" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "CalendarSourceKind" AS ENUM ('ics_import', 'microsoft', 'google');

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

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "type" "ItemType" NOT NULL DEFAULT 'task',
    "state" "ItemState" NOT NULL DEFAULT 'INBOX',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "waitingOn" TEXT,
    "waitingSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "attachments" JSONB,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT,
    "actionText" TEXT NOT NULL,
    "context" "ContextTag",
    "energy" "EnergyLevel",
    "estimatedMinutes" INTEGER,
    "dueDate" TIMESTAMP(3),
    "projectId" TEXT,
    "priority" INTEGER DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "snoozedUntil" TIMESTAMP(3),
    "pinnedOrder" INTEGER,
    "manualRank" INTEGER,
    "unverified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT,
    "outcomeStatement" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'CLARIFYING',
    "nextActionTaskId" TEXT,
    "dueDate" TIMESTAMP(3),
    "reviewInterval" INTEGER,
    "priority" INTEGER DEFAULT 0,
    "focusThisWeek" BOOLEAN NOT NULL DEFAULT false,
    "lastProgressAt" TIMESTAMP(3),
    "themeTag" TEXT,
    "waitingOn" TEXT,
    "waitingSince" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "artifactType" "ArtifactType" NOT NULL,
    "content" TEXT,
    "filePointer" TEXT,
    "linkedItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'snooze',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransitionAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "itemId" TEXT NOT NULL,
    "fromState" TEXT NOT NULL,
    "toStateAttempted" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reasons" JSONB,
    "override" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,

    CONSTRAINT "TransitionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReviewSessionType" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "stepsCompleted" JSONB,
    "itemsProcessedCount" INTEGER NOT NULL DEFAULT 0,
    "itemsSkippedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CalendarSourceKind" NOT NULL,
    "config" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "calendarSourceId" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "recurrenceRule" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Item_userId_idx" ON "Item"("userId");

-- CreateIndex
CREATE INDEX "Item_userId_state_idx" ON "Item"("userId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Task_itemId_key" ON "Task"("itemId");

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_itemId_key" ON "Project"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_nextActionTaskId_key" ON "Project"("nextActionTaskId");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "ReviewSession_userId_idx" ON "ReviewSession"("userId");

-- CreateIndex
CREATE INDEX "CalendarSource_userId_idx" ON "CalendarSource"("userId");

-- CreateIndex
CREATE INDEX "CalendarEvent_calendarSourceId_start_end_idx" ON "CalendarEvent"("calendarSourceId", "start", "end");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_calendarSourceId_externalId_key" ON "CalendarEvent"("calendarSourceId", "externalId");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_nextActionTaskId_fkey" FOREIGN KEY ("nextActionTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_linkedItemId_fkey" FOREIGN KEY ("linkedItemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransitionAuditLog" ADD CONSTRAINT "TransitionAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSession" ADD CONSTRAINT "ReviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSource" ADD CONSTRAINT "CalendarSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_calendarSourceId_fkey" FOREIGN KEY ("calendarSourceId") REFERENCES "CalendarSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
