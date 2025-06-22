-- Test the subscription status edge function
-- Replace 'your-user-id-here' with an actual user ID from your auth.users table

-- First, let's see what users we have
SELECT id, email FROM auth.users LIMIT 5;

-- Then test the subscription function with a real user ID
-- Replace the user_id in the JSON below with one from the query above
SELECT 
  net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/check_subscription_status',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer your-anon-key"}',
    body := '{"user_id": "your-user-id-here"}'
  ) as response;

-- To see the actual response content, you can also run:
SELECT 
  body::json as response_json
FROM net.http_post(
  url := 'https://your-project-ref.supabase.co/functions/v1/check_subscription_status',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer your-anon-key"}',
  body := '{"user_id": "your-user-id-here"}'
); 