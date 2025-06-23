-- Check if there's a client_organisation record for rickychopra@me.com
SELECT 
    co.id,
    co.organisation_name,
    co.auth_user_id,
    co.is_active,
    co.created_at,
    eu.email,
    eu.first_name,
    eu.last_name,
    eu.org_name
FROM client_organisation co
JOIN end_users eu ON co.auth_user_id = eu.auth_user_id
WHERE eu.email = 'rickychopra@me.com';

-- Check all client_organisation records
SELECT 
    id,
    organisation_name,
    auth_user_id,
    is_active,
    created_at
FROM client_organisation
ORDER BY created_at DESC
LIMIT 5; 