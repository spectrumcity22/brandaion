-- View the current split_questions_into_review function exactly as it exists
SELECT 
    'Current Function Code' as check_type,
    p.proname as function_name,
    p.prosrc as function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'split_questions_into_review'; 