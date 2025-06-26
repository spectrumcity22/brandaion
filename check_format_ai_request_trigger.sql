-- Check if the format_ai_request trigger exists and is enabled
SELECT 
    'Trigger Status' as check_type,
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    CASE WHEN t.tgenabled = 'O' THEN 'Enabled' ELSE 'Disabled' END as status,
    CASE 
        WHEN t.tgtype & 66 = 2 THEN 'BEFORE'
        WHEN t.tgtype & 66 = 64 THEN 'AFTER'
        WHEN t.tgtype & 66 = 0 THEN 'INSTEAD OF'
        ELSE 'UNKNOWN'
    END as timing,
    CASE 
        WHEN t.tgtype & 28 = 4 THEN 'INSERT'
        WHEN t.tgtype & 28 = 8 THEN 'DELETE'
        WHEN t.tgtype & 28 = 16 THEN 'UPDATE'
        WHEN t.tgtype & 28 = 12 THEN 'INSERT OR DELETE'
        WHEN t.tgtype & 28 = 20 THEN 'INSERT OR UPDATE'
        WHEN t.tgtype & 28 = 24 THEN 'DELETE OR UPDATE'
        WHEN t.tgtype & 28 = 28 THEN 'INSERT OR DELETE OR UPDATE'
        ELSE 'UNKNOWN'
    END as event
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'construct_faq_pairs'
  AND p.proname = 'format_ai_request'
ORDER BY t.tgname;

-- Check if the format_ai_request function exists
SELECT 
    'Function Status' as check_type,
    p.proname as function_name,
    CASE WHEN p.proname IS NOT NULL THEN '✅ Exists' ELSE '❌ Missing' END as status,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'format_ai_request';

-- Check current construct_faq_pairs records to see if ai_request_for_questions is populated
SELECT 
    'Current Records' as check_type,
    id,
    unique_batch_id,
    ai_request_for_questions IS NOT NULL as has_ai_request,
    LEFT(ai_request_for_questions, 100) as ai_request_preview,
    question_status
FROM construct_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
ORDER BY timestamp DESC
LIMIT 5;

-- Check if client_configuration has the required data for the trigger
SELECT 
    'Client Configuration Data' as check_type,
    cc.id,
    cc.auth_user_id,
    cc.brand_jsonld_object IS NOT NULL as has_brand_jsonld,
    cc.schema_json IS NOT NULL as has_schema_json,
    cc.organisation_jsonld_object IS NOT NULL as has_org_jsonld,
    cc.market_name,
    cc.product_name,
    cc.audience_name
FROM client_configuration cc
WHERE cc.auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'; 