-- Check what subscription functions actually exist
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname LIKE '%subscription%'
ORDER BY p.proname;

-- Also check for any functions with similar names
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND (p.proname LIKE '%check%' OR p.proname LIKE '%subscription%' OR p.proname LIKE '%user%')
ORDER BY p.proname; 