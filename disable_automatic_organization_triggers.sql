-- Disable automatic organization triggers
-- We want manual control over when these functions run, not automatic triggers

-- Disable the automatic slug generation trigger
DROP TRIGGER IF EXISTS trigger_organization_slug_generation ON client_organisation;

-- Disable the automatic JSON-LD generation trigger
DROP TRIGGER IF EXISTS set_organisation_jsonld_object ON client_organisation;

-- Disable the automatic linking trigger
DROP TRIGGER IF EXISTS trg_link_org_to_user ON client_organisation;

-- Disable the automatic sync trigger
DROP TRIGGER IF EXISTS trg_sync_org_jsonld ON client_organisation;

-- Verify triggers are disabled
SELECT 
    'Disabled Triggers' as check_type,
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    CASE WHEN t.tgenabled = 'O' THEN 'Enabled' ELSE 'Disabled' END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'client_organisation'
ORDER BY t.tgname;

-- Create manual functions that can be called from the frontend
-- These will be triggered from the LLM discovery construction page

-- Manual function to generate organization slug
CREATE OR REPLACE FUNCTION manual_generate_organization_slug(org_id UUID)
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
    
    -- Insert or update the slug
    INSERT INTO organization_slugs (organization_id, slug, organization_name)
    VALUES (org_id, final_slug, org_name)
    ON CONFLICT (organization_id) 
    DO UPDATE SET 
        slug = EXCLUDED.slug,
        organization_name = EXCLUDED.organization_name,
        updated_at = NOW();
    
    -- Update the client_organisation table with the slug
    UPDATE client_organisation 
    SET slug = final_slug 
    WHERE id = org_id;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Manual function to generate organization JSON-LD
CREATE OR REPLACE FUNCTION manual_generate_organization_jsonld(org_id UUID)
RETURNS JSONB AS $$
DECLARE
    org_record RECORD;
    jsonld_data JSONB;
BEGIN
    SELECT 
        co.id,
        co.organisation_name,
        co.organisation_url,
        co.linkedin_url,
        co.industry,
        co.subcategory,
        co.headquarters,
        os.slug
    INTO org_record
    FROM client_organisation co
    LEFT JOIN organization_slugs os ON os.organization_id = co.id
    WHERE co.id = org_id;
    
    IF org_record.id IS NULL THEN
        RETURN NULL;
    END IF;
    
    jsonld_data := jsonb_build_object(
        '@context', 'https://schema.org',
        '@type', 'Organization',
        '@id', 'https://brandaion.com/data/organizations/' || COALESCE(org_record.slug, 'default') || '/organization.jsonld',
        'name', org_record.organisation_name,
        'url', COALESCE(org_record.organisation_url, ''),
        'description', 'Organization data from BrandAION platform',
        'industry', COALESCE(org_record.industry, ''),
        'subcategory', COALESCE(org_record.subcategory, ''),
        'headquarters', COALESCE(org_record.headquarters, ''),
        'sameAs', CASE 
            WHEN org_record.linkedin_url IS NOT NULL THEN jsonb_build_array(org_record.linkedin_url)
            ELSE '[]'::jsonb
        END
    );
    
    -- Update the organization with the JSON-LD
    UPDATE client_organisation 
    SET organisation_jsonld_object = jsonld_data
    WHERE id = org_id;
    
    RETURN jsonld_data;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION manual_generate_organization_slug(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION manual_generate_organization_jsonld(UUID) TO authenticated;

-- Test the manual functions
SELECT 
    'Manual Functions Created' as check_type,
    'manual_generate_organization_slug' as function_name,
    'Ready for manual execution' as status; 