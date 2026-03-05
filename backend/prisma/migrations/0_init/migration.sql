-- CreateEnum
CREATE TYPE "AgentRole" AS ENUM ('admin', 'agent');
CREATE TYPE "ConversationStatus" AS ENUM ('open', 'closed');
CREATE TYPE "MessageDirection" AS ENUM ('inbound', 'outbound');

-- CreateTable
CREATE TABLE "oa_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel_access_token_encrypted" TEXT NOT NULL,
    "channel_secret_encrypted" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oa_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AgentRole" NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "display_name" TEXT,
    "picture_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_identities" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'line',
    "provider_user_id" TEXT NOT NULL,
    "oa_id" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "oa_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'line',
    "provider_chat_id" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_assignments" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "assigned_agent_id" TEXT NOT NULL,
    "assigned_by_agent_id" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMP(3),

    CONSTRAINT "conversation_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "oa_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "provider_event_id" TEXT,
    "provider_message_id" TEXT,
    "message_type" TEXT NOT NULL DEFAULT 'text',
    "text" TEXT,
    "raw_json" JSONB,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_threads" (
    "conversation_id" TEXT NOT NULL,
    "oa_id" TEXT NOT NULL,
    "assigned_agent_id" TEXT,
    "status" "ConversationStatus" NOT NULL,
    "last_message_at" TIMESTAMP(3) NOT NULL,
    "last_message_preview" TEXT,
    "last_message_direction" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_threads_pkey" PRIMARY KEY ("conversation_id")
);

-- CreateTable
CREATE TABLE "provider_events" (
    "id" TEXT NOT NULL,
    "oa_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'line',
    "provider_event_id" TEXT NOT NULL,
    "raw_json" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_agent_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "conversations_oa_id_status_idx" ON "conversations"("oa_id", "status");
CREATE UNIQUE INDEX "contact_identities_oa_id_provider_user_id_key" ON "contact_identities"("oa_id", "provider_user_id");
CREATE INDEX "messages_conversation_id_sent_at_idx" ON "messages"("conversation_id", "sent_at" DESC);
CREATE INDEX "inbox_threads_assigned_agent_id_status_last_message_at_idx" ON "inbox_threads"("assigned_agent_id", "status", "last_message_at" DESC);
CREATE UNIQUE INDEX "provider_events_oa_id_provider_event_id_key" ON "provider_events"("oa_id", "provider_event_id");

-- FKs
ALTER TABLE "contact_identities" ADD CONSTRAINT "contact_identities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_oa_id_fkey" FOREIGN KEY ("oa_id") REFERENCES "oa_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_assignments" ADD CONSTRAINT "conversation_assignments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_assignments" ADD CONSTRAINT "conversation_assignments_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_assignments" ADD CONSTRAINT "conversation_assignments_assigned_by_agent_id_fkey" FOREIGN KEY ("assigned_by_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_oa_id_fkey" FOREIGN KEY ("oa_id") REFERENCES "oa_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inbox_threads" ADD CONSTRAINT "inbox_threads_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inbox_threads" ADD CONSTRAINT "inbox_threads_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_events" ADD CONSTRAINT "provider_events_oa_id_fkey" FOREIGN KEY ("oa_id") REFERENCES "oa_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_agent_id_fkey" FOREIGN KEY ("actor_agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
