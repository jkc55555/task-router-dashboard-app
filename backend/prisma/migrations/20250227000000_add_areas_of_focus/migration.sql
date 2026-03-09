-- Areas of Focus: new table + optional areaId on Project
CREATE TABLE IF NOT EXISTS "AreaOfFocus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "archivedAt" TIMESTAMP(3),
    "lastAcknowledgedAt" TIMESTAMP(3),
    "lastAcknowledgedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AreaOfFocus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AreaOfFocus_userId_name_key" ON "AreaOfFocus"("userId", "name");
CREATE INDEX IF NOT EXISTS "AreaOfFocus_userId_idx" ON "AreaOfFocus"("userId");

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "areaId" TEXT;

CREATE INDEX IF NOT EXISTS "Project_areaId_idx" ON "Project"("areaId");

DO $$ BEGIN
  ALTER TABLE "Project" ADD CONSTRAINT "Project_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "AreaOfFocus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
