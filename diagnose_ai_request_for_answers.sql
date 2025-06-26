-- Diagnostic SQL to check what's already there for ai_request_for_answers

-- 1. Check all triggers on review_questions table
SELECT 
    'All Triggers on review_questions' as check_type,
    t.tgname as trigger_name,
    t.tgenabled as trigger_enabled,
    p.proname as function_name,
    CASE t.tgtype & 66
        WHEN 2 THEN 'BEFORE'
        WHEN 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
    END as trigger_timing,
    CASE t.tgtype & 28
        WHEN 4 THEN 'INSERT'
        WHEN 8 THEN 'DELETE'
        WHEN 16 THEN 'UPDATE'
        WHEN 12 THEN 'INSERT OR DELETE'
        WHEN 20 THEN 'INSERT OR UPDATE'
        WHEN 24 THEN 'DELETE OR UPDATE'
        WHEN 28 THEN 'INSERT OR DELETE OR UPDATE'
    END as trigger_events
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'review_questions'
ORDER BY t.tgname;

-- 2. Check all functions that might be related to ai_request_for_answers
SELECT 
    'Functions with ai_request in name' as check_type,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname LIKE '%ai_request%'
ORDER BY p.proname;

-- 3. Check the current state of review_questions table structure
SELECT 
    'review_questions table structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'review_questions'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Check current data in review_questions table to see what's missing
SELECT 
    'Current review_questions data analysis' as check_type,
    COUNT(*) as total_questions,
    COUNT(CASE WHEN question_status = 'question_approved' THEN 1 END) as approved_questions,
    COUNT(CASE WHEN ai_request_for_answers IS NOT NULL AND ai_request_for_answers != '' THEN 1 END) as questions_with_ai_request,
    COUNT(CASE WHEN question_status = 'question_approved' AND (ai_request_for_answers IS NULL OR ai_request_for_answers = '') THEN 1 END) as approved_without_ai_request
FROM review_questions;

-- 5. Show sample of approved questions that are missing ai_request_for_answers
SELECT 
    'Sample approved questions missing ai_request_for_answers' as check_type,
    id,
    unique_batch_id,
    question,
    question_status,
    answer_status,
    ai_request_for_answers IS NULL as missing_ai_request,
    topic,
    organisation,
    market_name,
    audience_name
FROM review_questions 
WHERE question_status = 'question_approved'
  AND (ai_request_for_answers IS NULL OR ai_request_for_answers = '')
ORDER BY created_at DESC
LIMIT 5;

-- 6. Check if the generate_ai_request_for_answers function exists
SELECT 
    'generate_ai_request_for_answers function check' as check_type,
    p.proname as function_name,
    CASE 
        WHEN p.proname IS NOT NULL THEN '✅ Function exists'
        ELSE '❌ Function missing'
    END as status,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'generate_ai_request_for_answers';

-- 7. Check if there are any triggers that call generate_ai_request_for_answers
SELECT 
    'Triggers calling generate_ai_request_for_answers' as check_type,
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE p.proname LIKE '%generate_ai_request_for_answers%'
ORDER BY c.relname, t.tgname;

-- 8. Check what happens when we manually call the function on a sample record
SELECT 
    'Manual function test' as check_type,
    id,
    unique_batch_id,
    question,
    topic,
    organisation,
    market_name,
    audience_name,
    CASE 
        WHEN unique_batch_id IS NOT NULL THEN 'Can call function'
        ELSE 'Missing required data'
    END as can_call_function
FROM review_questions 
WHERE question_status = 'question_approved'
  AND (ai_request_for_answers IS NULL OR ai_request_for_answers = '')
  AND unique_batch_id IS NOT NULL
LIMIT 1; 