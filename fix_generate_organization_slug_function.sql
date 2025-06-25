-- Fix the generate_organization_slug function
-- The function is returning null, causing the not-null constraint violation

-- First, let's check the current function definition
SELECT 
    'Current Function' as check_type,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'generate_organization_slug';

-- Fix the function to handle edge cases and ensure it never returns null
CREATE OR REPLACE FUNCTION generate_organization_slug(org_id UUID)
RETURNS TEXT AS $$
DECLARE
    org_name TEXT;
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Get organization name
    SELECT organisation_name INTO org_name 
    FROM client_organisation 
    WHERE id = org_id;
    
    -- If organization name is null or empty, generate a fallback slug
    IF org_name IS NULL OR trim(org_name) = '' THEN
        org_name := 'organization-' || org_id::text;
    END IF;
    
    -- Generate base slug
    base_slug := generate_slug(org_name);
    
    -- Ensure we have a valid slug
    IF base_slug IS NULL OR trim(base_slug) = '' THEN
        base_slug := 'organization-' || org_id::text;
    END IF;
    
    final_slug := base_slug;
    
    -- Check for uniqueness and add counter if needed
    WHILE EXISTS (SELECT 1 FROM organization_slugs WHERE slug = final_slug AND organization_id != org_id) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter::TEXT;
    END LOOP;
    
    -- Final safety check - ensure we never return null
    IF final_slug IS NULL OR trim(final_slug) = '' THEN
        final_slug := 'organization-' || org_id::text;
    END IF;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Also fix the generate_slug function to handle edge cases
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Handle null or empty input
    IF input_text IS NULL OR trim(input_text) = '' THEN
        RETURN 'default-slug';
    END IF;
    
    RETURN lower(
        regexp_replace(
            regexp_replace(
                regexp_replace(input_text, '[^a-zA-Z0-9\s-]', '', 'g'),
                '\s+', '-', 'g'
            ),
            '-+', '-', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Test the function with a sample organization
SELECT 
    'Function Test' as check_type,
    generate_organization_slug('00000000-0000-0000-0000-000000000000') as test_slug;

-- Verify the trigger function is working
SELECT 
    'Trigger Function' as check_type,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'trigger_generate_organization_slug'; 