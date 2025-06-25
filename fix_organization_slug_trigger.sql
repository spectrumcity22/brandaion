-- Fix the trigger_generate_organization_slug function
-- The error is caused by referencing EXCLUDED.organisation_name instead of EXCLUDED.organization_name

-- Drop the problematic trigger first
DROP TRIGGER IF EXISTS trigger_organization_slug_generation ON client_organisation;

-- Fix the function to use the correct column name
CREATE OR REPLACE FUNCTION trigger_generate_organization_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := generate_organization_slug(NEW.id);
    END IF;
    
    -- Insert or update organization_slugs table
    -- Fix: Use EXCLUDED.organization_name instead of EXCLUDED.organisation_name
    INSERT INTO organization_slugs (organization_id, slug, organization_name)
    VALUES (NEW.id, NEW.slug, NEW.organisation_name)
    ON CONFLICT (organization_id) 
    DO UPDATE SET 
        slug = EXCLUDED.slug,
        organization_name = EXCLUDED.organization_name,  -- Fixed: removed the 's'
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_organization_slug_generation
    BEFORE INSERT OR UPDATE ON client_organisation
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_organization_slug();

-- Verify the fix
SELECT 
    'Trigger Fixed' as check_type,
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    CASE WHEN t.tgenabled = 'O' THEN 'Enabled' ELSE 'Disabled' END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'client_organisation' 
AND t.tgname = 'trigger_organization_slug_generation'; 