-- Step 21: Check what organisation should be set for this user
SELECT 
    co.id,
    co.organisation_name,
    co.auth_user_id
FROM client_organisation co
WHERE co.auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'; 