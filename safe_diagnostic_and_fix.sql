-- Safe diagnostic and fix for format_ai_request trigger
-- This version checks first and only makes changes if needed

-- 1. Check current trigger status
SELECT 
    'Current Trigger Status' as check_type,
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    CASE WHEN t.tgenabled = 'O' THEN 'Enabled' ELSE 'Disabled' END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'construct_faq_pairs'
  AND p.proname = 'format_ai_request';

-- 2. Check current records status
SELECT 
    'Current Records Status' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN ai_request_for_questions IS NOT NULL THEN 1 END) as with_ai_request,
    COUNT(CASE WHEN ai_request_for_questions IS NULL THEN 1 END) as missing_ai_request
FROM construct_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- 3. Show sample of records missing ai_request_for_questions
SELECT 
    'Records Missing AI Request' as check_type,
    id,
    unique_batch_id,
    organisation,
    question_status,
    ai_request_for_questions IS NULL as missing_ai_request
FROM construct_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND ai_request_for_questions IS NULL
LIMIT 3;

-- 4. Check if function exists
SELECT 
    'Function Status' as check_type,
    p.proname as function_name,
    CASE WHEN p.proname IS NOT NULL THEN '✅ Exists' ELSE '❌ Missing' END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'format_ai_request';

-- 5. Show what the current function definition looks like (if it exists)
SELECT 
    'Current Function Definition' as check_type,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'format_ai_request';

-- 6. Show sample of existing ai_request_for_questions (if any exist)
SELECT 
    'Sample Existing AI Requests' as check_type,
    id,
    unique_batch_id,
    LEFT(ai_request_for_questions, 150) as ai_request_preview
FROM construct_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND ai_request_for_questions IS NOT NULL
ORDER BY timestamp DESC
LIMIT 2; 