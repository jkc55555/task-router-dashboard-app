-- Add inbox email fields to User for email-to-inbox feature
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inboxEmailToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inboxEmailEnabled" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "User_inboxEmailToken_key" ON "User"("inboxEmailToken");
