-- Quick check of all triggers on construct_faq_pairs
SELECT 
    'All Triggers Status' as check_type,
    t.tgname as trigger_name,
    t.tgenabled as trigger_enabled,
    p.proname as function_name,
    CASE t.tgtype & 66
        WHEN 2 THEN 'BEFORE'
        WHEN 64 THEN 'AFTER'
        ELSE 'INSTEAD OF'
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
WHERE c.relname = 'construct_faq_pairs'
ORDER BY t.tgname;

-- Check if the questions generation trigger specifically exists
SELECT 
    'Questions Trigger Check' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_trigger t
            JOIN pg_class c ON t.tgrelid = c.oid
            WHERE c.relname = 'construct_faq_pairs' 
              AND t.tgname = 'tr_generate_questions'
        ) THEN '✅ Questions trigger exists'
        ELSE '❌ Questions trigger missing'
    END as status; 