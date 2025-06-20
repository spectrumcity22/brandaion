-- Step 14: Check how organisation_jsonld_object is being populated in review_questions

-- Check if there are any functions that update review_questions with organisation_jsonld_object
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    p.prosrc as function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosrc ILIKE '%organisation_jsonld_object%'
  AND p.prosrc ILIKE '%review_questions%'
ORDER BY p.proname;

-- Check if there are any triggers on review_questions that might populate this field
SELECT 
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'review_questions'
ORDER BY t.tgname; 