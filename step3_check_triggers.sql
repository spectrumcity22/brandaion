-- Step 3: Check what triggers exist and what tables they're attached to
SELECT 
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    t.tgtype,
    t.tgenabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('construct_faq_pairs', 'review_questions', 'approved_questions')
  AND t.tgname LIKE '%split%'
ORDER BY c.relname, t.tgname; 