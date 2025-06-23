-- Fix RLS policies for client_organisation table
-- Enable RLS if not already enabled
ALTER TABLE client_organisation ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies that might be causing issues
DROP POLICY IF EXISTS "Users can view their own organisations" ON client_organisation;
DROP POLICY IF EXISTS "Users can insert their own organisations" ON client_organisation;
DROP POLICY IF EXISTS "Users can update their own organisations" ON client_organisation;

-- Create RLS policies for client_organisation
CREATE POLICY "Users can view their own organisations"
    ON client_organisation
    FOR SELECT
    USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own organisations"
    ON client_organisation
    FOR INSERT
    WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own organisations"
    ON client_organisation
    FOR UPDATE
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- Verify policies were created
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'client_organisation'
ORDER BY policyname; 