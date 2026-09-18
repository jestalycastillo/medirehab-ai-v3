ALTER TYPE "NotificationType" ADD VALUE 'CHAT_MESSAGE';

CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_messages_senderUserId_recipientUserId_createdAt_idx"
ON "chat_messages"("senderUserId", "recipientUserId", "createdAt");

CREATE INDEX "chat_messages_recipientUserId_readAt_createdAt_idx"
ON "chat_messages"("recipientUserId", "readAt", "createdAt");

ALTER TABLE "chat_messages"
ADD CONSTRAINT "chat_messages_senderUserId_fkey"
FOREIGN KEY ("senderUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
ADD CONSTRAINT "chat_messages_recipientUserId_fkey"
FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
