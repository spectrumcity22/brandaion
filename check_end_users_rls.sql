-- Check RLS policies on end_users table
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'end_users'
ORDER BY policyname;

-- Check if RLS is enabled on end_users
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'end_users';

-- Check if there are any existing records in end_users
SELECT COUNT(*) as total_records FROM end_users;

-- Check recent records if any exist
SELECT 
    id,
    auth_user_id,
    email,
    first_name,
    last_name,
    org_name,
    status,
    inserted_at
FROM end_users 
ORDER BY inserted_at DESC 
LIMIT 5; 