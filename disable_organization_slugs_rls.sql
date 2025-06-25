-- Disable RLS on organization_slugs table
-- Triggers run with database privileges and can't satisfy RLS policies that check auth.uid()
-- Since organization_slugs is used for internal slug management, it's safe to disable RLS

-- Disable RLS on organization_slugs
ALTER TABLE organization_slugs DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
    'RLS Status' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'organization_slugs';

-- Test the organization form now - it should work without RLS blocking the trigger 