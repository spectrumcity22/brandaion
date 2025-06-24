-- Step 16: Check if the organisation exists for this user
-- Replace 'USER_AUTH_ID_HERE' with the actual auth_user_id from the invoice

SELECT 
    co.id,
    co.organisation,
    co.auth_user_id
FROM client_organisation co
WHERE co.auth_user_id = 'USER_AUTH_ID_HERE'; 