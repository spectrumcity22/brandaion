-- Production-ready RLS policy for organization_slugs
-- This allows triggers to work while maintaining security

-- First, re-enable RLS if it was disabled
ALTER TABLE organization_slugs ENABLE ROW LEVEL SECURITY;

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Allow organization slug management" ON organization_slugs;

-- Create a production-ready policy that allows:
-- 1. Triggers to insert/update (using security definer functions)
-- 2. Users to manage their own organization slugs
-- 3. Public read access for discovery system

-- Policy for users to manage their own organization slugs
CREATE POLICY "Users can manage their organization slugs"
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

-- Policy for public read access (needed for LLM discovery system)
CREATE POLICY "Public read access for organization slugs"
    ON organization_slugs
    FOR SELECT
    USING (true);

-- Create a security definer function for triggers to use
-- This function runs with elevated privileges and can bypass RLS
CREATE OR REPLACE FUNCTION insert_organization_slug_safe(
    p_organization_id UUID,
    p_slug TEXT,
    p_organization_name TEXT
)
RETURNS VOID
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO organization_slugs (organization_id, slug, organization_name)
    VALUES (p_organization_id, p_slug, p_organization_name)
    ON CONFLICT (organization_id) 
    DO UPDATE SET 
        slug = EXCLUDED.slug,
        organization_name = EXCLUDED.organization_name,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Update the trigger to use the security definer function
DROP TRIGGER IF EXISTS trigger_organization_slug_generation ON client_organisation;

CREATE OR REPLACE FUNCTION trigger_generate_organization_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := generate_organization_slug(NEW.id);
    END IF;
    
    -- Use the security definer function instead of direct insert
    PERFORM insert_organization_slug_safe(NEW.id, NEW.slug, NEW.organisation_name);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_organization_slug_generation
    BEFORE INSERT OR UPDATE ON client_organisation
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_organization_slug();

-- Verify the setup
SELECT 
    'Production RLS Setup' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'organization_slugs'
ORDER BY policyname;

-- Test the organization form now 