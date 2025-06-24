-- Check if organization data exists for the user
SELECT * FROM client_organisation 
WHERE auth_user_id = '134554f6-477e-4b63-bd31-de4c537bb7c1';

-- Query 1: Count organizations
SELECT 
    'Organization Count' as check_type,
    COUNT(*) as org_count
FROM client_organisation 
WHERE auth_user_id = '134554f6-477e-4b63-bd31-de4c537bb7c1';

-- Query 2: Organization details
SELECT 
    'Organization Details' as check_type,
    id as org_id,
    organisation_name,
    organisation_jsonld_object IS NOT NULL as has_jsonld,
    CASE 
        WHEN organisation_jsonld_object IS NOT NULL THEN 'Has JSON-LD'
        ELSE 'No JSON-LD'
    END as jsonld_status
FROM client_organisation 
WHERE auth_user_id = '134554f6-477e-4b63-bd31-de4c537bb7c1'; 