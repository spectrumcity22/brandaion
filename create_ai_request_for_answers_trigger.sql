-- Create trigger to populate ai_request_for_answers when question is approved
-- This uses the existing generate_ai_request_for_answers function

-- Create the trigger function
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

-- Create the trigger
DROP TRIGGER IF EXISTS tr_ai_request_for_answers ON public.review_questions;
CREATE TRIGGER tr_ai_request_for_answers
    BEFORE UPDATE ON public.review_questions
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_ai_request_for_answers();

-- Verify the trigger was created
SELECT 
    'Trigger Created Successfully' as status,
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    CASE WHEN t.tgenabled = 'O' THEN 'Enabled' ELSE 'Disabled' END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'review_questions'
  AND p.proname = 'trigger_ai_request_for_answers';

-- Test the trigger by updating an existing approved question
UPDATE review_questions 
SET question_status = 'question_approved'
WHERE id = 39
  AND question_status = 'question_approved'
  AND (ai_request_for_answers IS NULL OR ai_request_for_answers = '');

-- Check if the trigger worked
SELECT 
    'Test Result' as check_type,
    id,
    question_status,
    ai_request_for_answers IS NOT NULL as has_ai_request,
    LEFT(ai_request_for_answers, 100) as ai_request_preview,
    answer_status
FROM review_questions 
WHERE id = 39; 