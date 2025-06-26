-- Check if the format_ai_request trigger exists and its configuration

-- Check all triggers on construct_faq_pairs table
SELECT 
    'All Triggers on construct_faq_pairs' as check_type,
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
WHERE c.relname = 'construct_faq_pairs';

-- Specifically check for format_ai_request_trigger
SELECT 
    'Format AI Request Trigger Check' as check_type,
    t.tgname as trigger_name,
    t.tgenabled as trigger_enabled,
    p.proname as function_name,
    CASE 
        WHEN t.tgname IS NOT NULL THEN '✅ Trigger exists'
        ELSE '❌ Trigger missing'
    END as status,
    CASE t.tgenabled
        WHEN 'O' THEN 'Enabled'
        WHEN 'D' THEN 'Disabled'
        WHEN 'R' THEN 'Replica'
        ELSE 'Unknown'
    END as enabled_status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'construct_faq_pairs' 
  AND t.tgname = 'format_ai_request_trigger';

-- Check if the function exists
SELECT 
    'Function Check' as check_type,
    p.proname as function_name,
    CASE 
        WHEN p.proname IS NOT NULL THEN '✅ Function exists'
        ELSE '❌ Function missing'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'format_ai_request';

-- Show the function definition
SELECT 
    'Function Definition' as check_type,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'format_ai_request'; 