-- Fix RLS policies on organization_slugs table
-- The trigger is being blocked by RLS policies when trying to insert

-- First, let's check the current RLS policies
SELECT 
    'Current RLS Policies' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'organization_slugs'
ORDER BY policyname;

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Users can manage their organization slugs" ON organization_slugs;

-- Create a more permissive policy for organization_slugs
-- This allows triggers to insert/update organization slugs
CREATE POLICY "Allow organization slug management"
    ON organization_slugs
    FOR ALL
    USING (
        organization_id IN (
            SELECT id FROM client_organisation WHERE auth_user_id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT id FROM client_organisation WHERE auth_user_id = auth.uid()
        )
    );

-- Alternative: If the above is still too restrictive, we can temporarily disable RLS
-- ALTER TABLE organization_slugs DISABLE ROW LEVEL SECURITY;

-- Verify the new policy
SELECT 
    'Updated RLS Policies' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'organization_slugs'
ORDER BY policyname;

-- Test if the organization form works now 