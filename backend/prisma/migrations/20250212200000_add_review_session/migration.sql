-- CreateEnum
CREATE TYPE "ReviewSessionType" AS ENUM ('DAILY', 'WEEKLY');

-- CreateTable
CREATE TABLE "ReviewSession" (
    "id" TEXT NOT NULL,
    "type" "ReviewSessionType" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "stepsCompleted" JSONB,
    "itemsProcessedCount" INTEGER NOT NULL DEFAULT 0,
    "itemsSkippedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReviewSession_pkey" PRIMARY KEY ("id")
);
