-- Diagnostic check to see what we currently have in the database
-- This will help us understand what changed since yesterday when it was working

-- 1. Check what get_package_limits function currently exists
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'get_package_limits';

-- 2. Check if user_monthly_questions table exists and its structure
SELECT 
    table_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = t.table_name
    ) as exists
FROM (VALUES 
    ('user_monthly_questions'),
    ('user_monthly_llms'), 
    ('user_monthly_schedule')
) AS t(table_name);

-- 3. Check user_monthly_questions table structure if it exists
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_monthly_questions'
ORDER BY ordinal_position;

-- 4. Check if there are any RLS policies on user_monthly_questions
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_monthly_questions';

-- 5. Check if the check_user_subscription_status function exists
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'check_user_subscription_status';

-- 6. Check what packages exist in the packages table
SELECT 
    tier,
    pack,
    monthly_questions_limit,
    monthly_llms_limit
FROM packages 
ORDER BY tier;

-- 7. Check if there are any recent errors in the logs (if available)
-- This might not work in all environments but worth checking
SELECT 
    log_time,
    log_level,
    log_message
FROM pg_stat_activity 
WHERE state = 'active' 
AND query LIKE '%get_package_limits%'
ORDER BY log_time DESC
LIMIT 10; 