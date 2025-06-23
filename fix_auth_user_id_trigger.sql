-- Check the current auth_user_id trigger function
SELECT routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'set_invoice_auth_user';

-- Fix the auth_user_id trigger to handle missing users gracefully
CREATE OR REPLACE FUNCTION set_invoice_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    found_auth_user_id UUID;
BEGIN
    -- Look up the auth_user_id from end_users table using the email
    SELECT auth_user_id INTO found_auth_user_id
    FROM end_users
    WHERE email = NEW.user_email
    LIMIT 1;

    -- If we found a matching user, set the auth_user_id
    IF found_auth_user_id IS NOT NULL THEN
        NEW.auth_user_id := found_auth_user_id;
    ELSE
        -- If no user found, set to NULL to avoid foreign key constraint error
        NEW.auth_user_id := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql; 