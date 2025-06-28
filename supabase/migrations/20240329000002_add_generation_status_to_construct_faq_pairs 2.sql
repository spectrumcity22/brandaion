-- Add generation_status column to construct_faq_pairs table for backward compatibility
ALTER TABLE "public"."construct_faq_pairs" 
ADD COLUMN IF NOT EXISTS "generation_status" "text" DEFAULT 'pending';

-- Create a function to sync question_status to generation_status
CREATE OR REPLACE FUNCTION "public"."sync_question_to_generation_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Sync question_status to generation_status
    IF NEW.question_status = 'questions_generated' THEN
        NEW.generation_status := 'questions_generated';
    ELSIF NEW.question_status = 'pending' THEN
        NEW.generation_status := 'pending';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to automatically sync statuses
DROP TRIGGER IF EXISTS "tr_sync_question_to_generation_status" ON "public"."construct_faq_pairs";
CREATE TRIGGER "tr_sync_question_to_generation_status"
    BEFORE INSERT OR UPDATE ON "public"."construct_faq_pairs"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."sync_question_to_generation_status"();

-- Backfill existing records
UPDATE "public"."construct_faq_pairs" 
SET generation_status = question_status 
WHERE generation_status IS NULL OR generation_status = 'pending'; 