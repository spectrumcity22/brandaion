-- Create chat_messages table for storing AI chat conversations
-- This table will store user messages and AI responses for future reference

CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "response" "text" NOT NULL,
    "agent_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- Add primary key
ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");

-- Add foreign key to users table
ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_chat_messages_user_id" ON "public"."chat_messages"("user_id");
CREATE INDEX IF NOT EXISTS "idx_chat_messages_created_at" ON "public"."chat_messages"("created_at");
CREATE INDEX IF NOT EXISTS "idx_chat_messages_agent_id" ON "public"."chat_messages"("agent_id");

-- Add RLS (Row Level Security) policies
ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own chat messages
CREATE POLICY "Users can view own chat messages" ON "public"."chat_messages"
    FOR SELECT USING ("auth"."uid"() = "user_id");

-- Policy: Users can insert their own chat messages
CREATE POLICY "Users can insert own chat messages" ON "public"."chat_messages"
    FOR INSERT WITH CHECK ("auth"."uid"() = "user_id");

-- Policy: Users can update their own chat messages
CREATE POLICY "Users can update own chat messages" ON "public"."chat_messages"
    FOR UPDATE USING ("auth"."uid"() = "user_id");

-- Policy: Users can delete their own chat messages
CREATE POLICY "Users can delete own chat messages" ON "public"."chat_messages"
    FOR DELETE USING ("auth"."uid"() = "user_id");

-- Grant permissions
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";

-- Add comments
COMMENT ON TABLE "public"."chat_messages" IS 'Stores AI chat conversation history for users';
COMMENT ON COLUMN "public"."chat_messages"."user_id" IS 'Reference to the user who sent the message';
COMMENT ON COLUMN "public"."chat_messages"."message" IS 'The user message sent to the AI agent';
COMMENT ON COLUMN "public"."chat_messages"."response" IS 'The AI agent response';
COMMENT ON COLUMN "public"."chat_messages"."agent_id" IS 'The ID of the AI agent used (e.g., Perplexity agent ID)';
COMMENT ON COLUMN "public"."chat_messages"."created_at" IS 'Timestamp when the conversation occurred'; 