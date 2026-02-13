-- Mark the failed migration as successfully applied so P3009 stops.
-- Run against the same DB your Railway backend uses (use DATABASE_PUBLIC_URL from your machine).
UPDATE "_prisma_migrations"
SET "finished_at" = NOW(), "applied_steps_count" = 1, "logs" = NULL
WHERE "migration_name" = '20250212100000_add_task_manual_rank'
  AND "finished_at" IS NULL;
