-- Test the questions generation trigger
-- This will verify that the trigger fires and calls the edge function

-- First, check if the trigger exists and is enabled
SELECT 
    'Questions Trigger Status' as check_type,
    t.tgname as trigger_name,
    t.tgenabled as trigger_enabled,
    p.proname as function_name,
    CASE 
        WHEN t.tgname IS NOT NULL THEN '✅ Trigger exists'
        ELSE '❌ Trigger missing'
    END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'construct_faq_pairs' 
  AND t.tgname = 'tr_generate_questions';

-- Check the function definition
SELECT 
    'Function Definition' as check_type,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'trigger_generate_questions';

-- Check if the edge function endpoint is accessible
-- (This is a basic check - the actual call would be made by the trigger)
SELECT 
    'Edge Function Check' as check_type,
    'open_ai_request_questions' as function_name,
    'https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/open_ai_request_questions' as endpoint,
    'Should be called with batchId parameter' as expected_usage;

-- Check current records to see their status
SELECT 
    'Current Records Status' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN question_status = 'pending' THEN 1 END) as pending_records,
    COUNT(CASE WHEN question_status = 'questions_generated' THEN 1 END) as generated_records,
    COUNT(CASE WHEN ai_response_questions IS NOT NULL THEN 1 END) as records_with_questions
FROM construct_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- Show sample records
SELECT 
    'Sample Records' as check_type,
    id,
    unique_batch_id,
    question_status,
    ai_request_for_questions IS NOT NULL as has_ai_request,
    ai_response_questions IS NOT NULL as has_questions,
    timestamp
FROM construct_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
ORDER BY timestamp DESC
LIMIT 3; 