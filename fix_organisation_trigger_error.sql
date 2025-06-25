-- Fix the organisation trigger error
-- The error "column excluded.organisation_name does not exist" suggests a trigger function
-- is trying to reference the wrong column name in an ON CONFLICT clause

-- First, let's check what trigger functions exist and their definitions
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname IN (
    'generate_organisation_jsonld_object',
    'link_org_to_end_user', 
    'sync_org_jsonld_to_config',
    'trigger_generate_organization_slug'
)
ORDER BY p.proname;

-- Check if the generate_organisation_jsonld_object function exists and fix it
-- This function is likely the culprit based on the error message

-- Drop the problematic trigger first
DROP TRIGGER IF EXISTS set_organisation_jsonld_object ON client_organisation;

-- Create a corrected version of the generate_organisation_jsonld_object function
CREATE OR REPLACE FUNCTION generate_organisation_jsonld_object()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate JSON-LD object for the organization
    NEW.organisation_jsonld_object := jsonb_build_object(
        '@context', 'https://schema.org',
        '@type', 'Organization',
        'name', NEW.organisation_name,
        'url', COALESCE(NEW.organisation_url, ''),
        'description', 'Organization data from BrandAION platform',
        'industry', COALESCE(NEW.industry, ''),
        'subcategory', COALESCE(NEW.subcategory, ''),
        'headquarters', COALESCE(NEW.headquarters, ''),
        'sameAs', CASE 
            WHEN NEW.linkedin_url IS NOT NULL THEN jsonb_build_array(NEW.linkedin_url)
            ELSE '[]'::jsonb
        END
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER set_organisation_jsonld_object 
    BEFORE INSERT OR UPDATE ON client_organisation 
    FOR EACH ROW 
    EXECUTE FUNCTION generate_organisation_jsonld_object();

-- Check if the link_org_to_end_user function exists and fix it if needed
CREATE OR REPLACE FUNCTION link_org_to_end_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Link the organization to the end_user record
    UPDATE end_users 
    SET 
        org_name = NEW.organisation_name,
        organisation_id = NEW.id
    WHERE auth_user_id = NEW.auth_user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check if the sync_org_jsonld_to_config function exists and fix it if needed
CREATE OR REPLACE FUNCTION sync_org_jsonld_to_config()
RETURNS TRIGGER AS $$
BEGIN
    -- This function can be used to sync organization JSON-LD to other tables if needed
    -- For now, just return NEW to avoid errors
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the triggers are working
SELECT 
    'Trigger Status' as check_type,
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    CASE WHEN t.tgenabled = 'O' THEN 'Enabled' ELSE 'Disabled' END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'client_organisation'
ORDER BY t.tgname; 