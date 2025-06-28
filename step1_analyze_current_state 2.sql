-- Step 1: Analyze Current State
-- Let's examine what we have before making changes

-- 1. Check the link_end_user_to_organisation function
SELECT 
    'Function Analysis' as check_type,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'link_end_user_to_organisation';

-- 2. Check what tables reference end_users
SELECT 
    'Table References' as check_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'end_users';

-- 3. Check what tables end_users references
SELECT 
    'Foreign Key References' as check_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS referenced_table_name,
    ccu.column_name AS referenced_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'end_users'
    AND kcu.column_name = 'organisation_id';

-- 4. Check current end_users data
SELECT 
    'Current Data' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN org_name IS NOT NULL THEN 1 END) as with_org_name,
    COUNT(CASE WHEN organisation_id IS NOT NULL THEN 1 END) as with_organisation_id,
    COUNT(CASE WHEN auth_user_id IS NOT NULL THEN 1 END) as with_auth_user_id
FROM end_users;

-- 5. Show sample end_users data
SELECT 
    'Sample Data' as check_type,
    id,
    email,
    first_name,
    last_name,
    full_name,
    org_name,
    organisation_id,
    auth_user_id,
    status,
    created_at
FROM end_users
ORDER BY created_at DESC
LIMIT 5;

-- 6. Check if organisation_id has a foreign key constraint
SELECT 
    'Foreign Key Check' as check_type,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS referenced_table_name,
    ccu.column_name AS referenced_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'end_users'
    AND kcu.column_name = 'organisation_id'; 