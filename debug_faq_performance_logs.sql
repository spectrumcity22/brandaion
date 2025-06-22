-- Check the faq_performance_logs table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'faq_performance_logs' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if there are any records in faq_performance_logs
SELECT COUNT(*) as total_records FROM faq_performance_logs;

-- Check recent records if any exist
SELECT 
    id,
    auth_user_id,
    question_id,
    test_schedule,
    test_month,
    tested_llms,
    created_at
FROM faq_performance_logs 
ORDER BY created_at DESC 
LIMIT 5;

-- Check RLS policies on faq_performance_logs
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
WHERE tablename = 'faq_performance_logs';

-- Check if the service role can insert into faq_performance_logs
-- This will help identify if it's an RLS issue
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'faq_performance_logs' 
AND grantee IN ('service_role', 'authenticated', 'anon'); 