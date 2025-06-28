-- Test the updated format_ai_request function
-- This will check if the function is working and populate ai_request_for_questions for existing records

-- First, let's check if there are any records without ai_request_for_questions
SELECT 
    'Records Missing AI Request' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) > 0 THEN '❌ Found records without ai_request_for_questions'
        ELSE '✅ All records have ai_request_for_questions'
    END as status
FROM construct_faq_pairs 
WHERE ai_request_for_questions IS NULL OR ai_request_for_questions = '';

-- Check a sample record to see the current state
SELECT 
    'Sample Record Check' as check_type,
    id,
    auth_user_id,
    organisation,
    batch_date,
    unique_batch_cluster,
    unique_batch_id,
    batch_faq_pairs,
    user_email,
    CASE 
        WHEN ai_request_for_questions IS NULL THEN 'NULL'
        WHEN ai_request_for_questions = '' THEN 'EMPTY'
        ELSE 'HAS DATA'
    END as ai_request_status,
    LEFT(ai_request_for_questions, 100) as ai_request_preview
FROM construct_faq_pairs 
LIMIT 3;

-- Check if the trigger is properly attached
SELECT 
    'Trigger Check' as check_type,
    t.tgname as trigger_name,
    t.tgenabled as trigger_enabled,
    p.proname as function_name,
    CASE 
        WHEN t.tgname IS NOT NULL THEN '✅ Trigger exists and is enabled'
        ELSE '❌ Trigger missing or disabled'
    END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'construct_faq_pairs' 
  AND t.tgname = 'format_ai_request_trigger';

-- Test the function manually on a sample record
-- First, let's find a record that needs updating
SELECT 
    'Manual Function Test' as check_type,
    id,
    auth_user_id,
    organisation,
    ai_request_for_questions
FROM construct_faq_pairs 
WHERE (ai_request_for_questions IS NULL OR ai_request_for_questions = '')
LIMIT 1; 