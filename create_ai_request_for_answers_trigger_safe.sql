-- Safe creation of trigger to populate ai_request_for_answers when question is approved
-- This uses the existing generate_ai_request_for_answers function

-- First, check if the trigger already exists
SELECT 
    'Current Trigger Status' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_trigger t
            JOIN pg_class c ON t.tgrelid = c.oid
            WHERE c.relname = 'review_questions' 
              AND t.tgname = 'tr_ai_request_for_answers'
        ) THEN '✅ Trigger already exists'
        ELSE '❌ Trigger missing - will create'
    END as status;

-- Create the trigger function (this is safe - it replaces the function)
CREATE OR REPLACE FUNCTION public.trigger_ai_request_for_answers()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process when question_status changes to 'question_approved'
    IF NEW.question_status = 'question_approved' AND OLD.question_status != 'question_approved' THEN
        
        -- Generate the ai_request_for_answers using the existing function
        NEW.ai_request_for_answers := public.generate_ai_request_for_answers(
            NEW.unique_batch_id,
            NEW.batch_faq_pairs,
            NEW.organisation,
            NEW.market_name,
            NEW.audience_name,
            NEW.persona_jsonld,
            NEW.product_jsonld_object,
            NEW.question,
            NEW.topic
        );
        
        -- Set answer_status to 'pending' to indicate it's ready for processing
        NEW.answer_status := 'pending';
        
        RAISE NOTICE 'Generated ai_request_for_answers for question %: %', NEW.id, LEFT(NEW.ai_request_for_answers, 100);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger only if it doesn't exist (safe approach)
DO $$
BEGIN
    -- Check if trigger exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname = 'review_questions' 
          AND t.tgname = 'tr_ai_request_for_answers'
    ) THEN
        -- Create the trigger
        CREATE TRIGGER tr_ai_request_for_answers
        BEFORE UPDATE ON public.review_questions
        FOR EACH ROW
        EXECUTE FUNCTION public.trigger_ai_request_for_answers();
        
        RAISE NOTICE '✅ Successfully created tr_ai_request_for_answers trigger';
    ELSE
        RAISE NOTICE 'ℹ️ Trigger already exists - function updated but trigger unchanged';
    END IF;
END $$;

-- Verify the trigger was created/updated
SELECT 
    'Final Trigger Status' as check_type,
    t.tgname as trigger_name,
    t.tgenabled as trigger_enabled,
    p.proname as function_name,
    CASE 
        WHEN t.tgname IS NOT NULL THEN '✅ Trigger exists and is enabled'
        ELSE '❌ Trigger still missing'
    END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'review_questions' 
  AND t.tgname = 'tr_ai_request_for_answers';

-- Test the trigger by manually calling the function on a sample record
-- This is safe - it only reads data and shows what would happen
SELECT 
    'Manual Function Test' as check_type,
    id,
    question,
    topic,
    organisation,
    market_name,
    audience_name,
    public.generate_ai_request_for_answers(
        unique_batch_id,
        batch_faq_pairs,
        organisation,
        market_name,
        audience_name,
        persona_jsonld,
        product_jsonld_object,
        question,
        topic
    ) as generated_ai_request
FROM review_questions 
WHERE id = 39
  AND question_status = 'question_approved'
  AND (ai_request_for_answers IS NULL OR ai_request_for_answers = '')
LIMIT 1; 