-- Step 13: Check the current split function and see what fields it's passing

-- Check if the split function still exists
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    p.prosrc as function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%split%'
ORDER BY p.proname; 