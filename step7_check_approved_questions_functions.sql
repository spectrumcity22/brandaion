-- Step 7: Check what functions are related to approved_questions table

-- Find functions that reference approved_questions table
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    p.prosrc as function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosrc ILIKE '%approved_questions%'
ORDER BY p.proname; 