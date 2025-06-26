-- Check organization data for the specific user
SELECT 
    'User Organization Check' as check_type,
    co.id as org_id,
    co.organisation_name,
    co.auth_user_id,
    co.organisation_jsonld_object IS NOT NULL as has_jsonld,
    CASE 
        WHEN co.organisation_jsonld_object IS NOT NULL THEN 'Has JSON-LD'
        ELSE 'No JSON-LD'
    END as jsonld_status
FROM client_organisation co
WHERE co.auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- Check if organization exists at all
SELECT 
    'Organization Existence' as check_type,
    COUNT(*) as org_count,
    CASE 
        WHEN COUNT(*) > 0 THEN 'Organization exists'
        ELSE 'No organization found'
    END as status
FROM client_organisation 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- Check brands for this user
SELECT 
    'User Brands' as check_type,
    b.id as brand_id,
    b.brand_name,
    b.organisation_name,
    b.brand_jsonld_object IS NOT NULL as has_brand_jsonld
FROM brands b
WHERE b.auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- Check current client_configuration
SELECT 
    'Current Configuration' as check_type,
    cc.id,
    cc.organisation_name,
    cc.organisation_jsonld_object IS NOT NULL as has_org_jsonld,
    cc.brand_jsonld_object IS NOT NULL as has_brand_jsonld
FROM client_configuration cc
WHERE cc.auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- Generate organization JSON-LD if missing
-- This will create the organization JSON-LD if it doesn't exist
SELECT 
    'Generating Organization JSON-LD' as action,
    manual_generate_organization_jsonld(co.id) as jsonld_result
FROM client_organisation co
WHERE co.auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND co.organisation_jsonld_object IS NULL;

-- Verify the organization JSON-LD was generated
SELECT 
    'Verification After Generation' as check_type,
    co.id as org_id,
    co.organisation_name,
    co.organisation_jsonld_object IS NOT NULL as has_jsonld,
    LEFT(co.organisation_jsonld_object::text, 100) as jsonld_preview
FROM client_organisation co
WHERE co.auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'; 