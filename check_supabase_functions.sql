-- Check all active SQL functions in Supabase
-- This file contains various queries to inspect functions in your database

-- 1. Get all user-defined functions (excluding system functions)
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    p.prosrc as function_source,
    p.prolang as language_id,
    l.lanname as language_name,
    p.prosecdef as security_definer,
    p.proleakproof as leakproof,
    p.proisstrict as is_strict,
    p.proretset as returns_set,
    p.provolatile as volatility
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
  AND n.nspname NOT LIKE 'pg_%'
ORDER BY n.nspname, p.proname;

-- 2. Get all functions including system functions (more comprehensive)
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    CASE 
        WHEN p.prosrc IS NOT NULL THEN 'SQL'
        WHEN p.probin IS NOT NULL THEN 'C'
        ELSE 'Other'
    END as function_type,
    p.prosrc as function_source,
    l.lanname as language_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
ORDER BY n.nspname, p.proname;

-- 3. Get only custom functions in public schema (most relevant for your app)
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    p.prosrc as function_source,
    l.lanname as language_name,
    p.prosecdef as security_definer,
    p.provolatile as volatility
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 4. Get function creation details and metadata
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    p.prosrc as function_source,
    p.prosecdef as security_definer,
    p.provolatile as volatility,
    p.proisstrict as is_strict,
    p.proretset as returns_set,
    p.proleakproof as leakproof,
    p.procost as estimated_cost,
    p.prorows as estimated_rows
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
  AND n.nspname NOT LIKE 'pg_%'
ORDER BY n.nspname, p.proname;

-- 5. Check for functions with specific patterns (useful for finding your app's functions)
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    p.prosrc as function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
  AND n.nspname NOT LIKE 'pg_%'
  AND (p.proname LIKE '%split%' 
       OR p.proname LIKE '%review%' 
       OR p.proname LIKE '%faq%'
       OR p.proname LIKE '%question%'
       OR p.proname LIKE '%trigger%')
ORDER BY n.nspname, p.proname;

-- 6. Get function permissions and ownership
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    u.usename as owner,
    p.prosecdef as security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_user u ON p.proowner = u.usesysid
WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
  AND n.nspname NOT LIKE 'pg_%'
ORDER BY n.nspname, p.proname;

-- 7. Count functions by schema
SELECT 
    n.nspname as schema_name,
    COUNT(*) as function_count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
  AND n.nspname NOT LIKE 'pg_%'
GROUP BY n.nspname
ORDER BY function_count DESC;

-- 8. Check for functions that might be related to your triggers
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    p.prosrc as function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosrc IS NOT NULL
  AND (p.prosrc ILIKE '%review_questions%' 
       OR p.prosrc ILIKE '%organisation_jsonld_object%'
       OR p.prosrc ILIKE '%split_questions%'
       OR p.prosrc ILIKE '%trigger%')
ORDER BY p.proname;

-- 9. Simple query to get all functions in public schema (most basic)
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments,
    pg_get_function_result(oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY proname;

-- 10. Check for functions that might be affecting your tables
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    p.prosrc as function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosrc IS NOT NULL
  AND (p.prosrc ILIKE '%review_questions%' 
       OR p.prosrc ILIKE '%organisation_jsonld_object%'
       OR p.prosrc ILIKE '%split_questions%'
       OR p.prosrc ILIKE '%trigger%'
       OR p.prosrc ILIKE '%insert%'
       OR p.prosrc ILIKE '%update%')
ORDER BY p.proname; 