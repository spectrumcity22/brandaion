-- Step 26: Check if the end_user exists for this auth_user_id
SELECT 
    id,
    auth_user_id,
    email
FROM end_users 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'; 