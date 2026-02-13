-- AlterEnum: Add CLARIFYING to ProjectStatus
ALTER TYPE "ProjectStatus" ADD VALUE 'CLARIFYING';

-- Make outcomeStatement nullable
ALTER TABLE "Project" ALTER COLUMN "outcomeStatement" DROP NOT NULL;

-- Add project-level waiting fields
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "waitingOn" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "waitingSince" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "followUpAt" TIMESTAMP(3);

-- Set default status to CLARIFYING for new rows (existing rows keep current status)
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'CLARIFYING';
