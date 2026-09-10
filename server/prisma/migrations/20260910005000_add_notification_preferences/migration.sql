ALTER TABLE "users"
ADD COLUMN "chatNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "careNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
