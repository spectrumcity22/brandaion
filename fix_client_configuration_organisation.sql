-- Fix the existing client configuration by adding organization data
-- This will update the client_configuration table with the missing organisation_jsonld_object

-- First, let's see what we're working with
SELECT 
    'Before Fix' as status,
    cc.id,
    cc.organisation_name,
    cc.organisation_jsonld_object IS NOT NULL as has_org_jsonld,
    co.organisation_name as org_name,
    co.organisation_jsonld_object IS NOT NULL as org_has_jsonld
FROM client_configuration cc
LEFT JOIN client_organisation co ON co.auth_user_id = cc.auth_user_id
WHERE cc.auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- Update the client_configuration with organization data
UPDATE client_configuration 
SET 
    organisation_name = co.organisation_name,
    organisation_jsonld_object = co.organisation_jsonld_object
FROM client_organisation co
WHERE client_configuration.auth_user_id = co.auth_user_id
  AND client_configuration.auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND client_configuration.organisation_jsonld_object IS NULL;

-- Verify the fix
SELECT 
    'After Fix' as status,
    cc.id,
    cc.organisation_name,
    cc.organisation_jsonld_object IS NOT NULL as has_org_jsonld,
    LEFT(cc.organisation_jsonld_object::text, 100) as jsonld_preview
FROM client_configuration cc
WHERE cc.auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- Also update any existing construct_faq_pairs that might be missing organization data
UPDATE construct_faq_pairs 
SET 
    organisation_jsonld_object = cc.organisation_jsonld_object
FROM client_configuration cc
WHERE construct_faq_pairs.auth_user_id = cc.auth_user_id
  AND construct_faq_pairs.auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND construct_faq_pairs.organisation_jsonld_object IS NULL
  AND cc.organisation_jsonld_object IS NOT NULL;

-- Verify construct_faq_pairs update
SELECT 
    'construct_faq_pairs After Fix' as status,
    cfp.id,
    cfp.organisation,
    cfp.organisation_jsonld_object IS NOT NULL as has_org_jsonld
FROM construct_faq_pairs cfp
WHERE cfp.auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'; 