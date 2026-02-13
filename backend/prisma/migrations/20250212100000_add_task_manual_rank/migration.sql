-- Add manualRank to Task for user-defined order within non-pinned set
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "manualRank" INTEGER;
