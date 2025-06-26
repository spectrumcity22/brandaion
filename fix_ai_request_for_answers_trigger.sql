-- Fix the missing ai_request_for_answers trigger
-- This trigger should populate ai_request_for_answers when a question is approved

-- First, check if the trigger already exists
SELECT 
    'Current Trigger Status' as check_type,
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    CASE WHEN t.tgenabled = 'O' THEN 'Enabled' ELSE 'Disabled' END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'review_questions'
  AND p.proname = 'generate_ai_request_for_answers_trigger';

-- Create the function to generate ai_request_for_answers
CREATE OR REPLACE FUNCTION public.generate_ai_request_for_answers_trigger()
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
DROP TRIGGER IF EXISTS tr_generate_ai_request_for_answers ON public.review_questions;
CREATE TRIGGER tr_generate_ai_request_for_answers
    BEFORE UPDATE ON public.review_questions
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_ai_request_for_answers_trigger();

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
  AND p.proname = 'generate_ai_request_for_answers_trigger';

-- Update existing approved questions that don't have ai_request_for_answers
UPDATE review_questions 
SET ai_request_for_answers = public.generate_ai_request_for_answers(
    unique_batch_id,
    batch_faq_pairs,
    organisation,
    market_name,
    audience_name,
    persona_jsonld,
    product_jsonld_object,
    question,
    topic
)
WHERE question_status = 'question_approved'
  AND (ai_request_for_answers IS NULL OR ai_request_for_answers = '')
  AND unique_batch_id IS NOT NULL;

-- Show the results
SELECT 
    'Updated Records' as check_type,
    COUNT(*) as updated_count
FROM review_questions 
WHERE question_status = 'question_approved'
  AND ai_request_for_answers IS NOT NULL
  AND ai_request_for_answers != '';

-- Show a sample of the updated records
SELECT 
    'Sample Updated Records' as check_type,
    id,
    unique_batch_id,
    question,
    LEFT(ai_request_for_answers, 100) as ai_request_preview,
    answer_status
FROM review_questions 
WHERE question_status = 'question_approved'
  AND ai_request_for_answers IS NOT NULL
  AND ai_request_for_answers != ''
ORDER BY updated_at DESC
LIMIT 3; 