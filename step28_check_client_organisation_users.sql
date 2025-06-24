-- Step 28: Check what users exist in client_organisation table
SELECT 
    auth_user_id,
    organisation_name,
    email
FROM client_organisation 
ORDER BY organisation_name; 