-- Check the end_users table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'end_users' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if organisation_id column exists in end_users
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'end_users' 
        AND column_name = 'organisation_id'
        AND table_schema = 'public'
    ) THEN '✅ organisation_id exists' ELSE '❌ organisation_id missing' END as status; 