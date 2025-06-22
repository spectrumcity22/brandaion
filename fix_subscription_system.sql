-- Drop the problematic duplicate function (takes user_email TEXT)
DROP FUNCTION IF EXISTS check_user_subscription_status(TEXT);

-- Test the correct existing function (takes user_id UUID)
-- First, let's see what users we have
SELECT id, email FROM auth.users LIMIT 3;

-- Then test with a real user_id (replace with actual user_id from above)
-- SELECT * FROM check_user_subscription_status('your-user-id-here');

-- Verify only the correct function exists
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'check_user_subscription_status'; 