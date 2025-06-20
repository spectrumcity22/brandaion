-- Check the current split_questions_into_review function definition
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'split_questions_into_review';

-- Also check what fields are available in construct_faq_pairs
SELECT 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name = 'construct_faq_pairs'
  AND (column_name LIKE '%organisation%' OR column_name LIKE '%brand%' OR column_name LIKE '%jsonld%')
ORDER BY column_name; 