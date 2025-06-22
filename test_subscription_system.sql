-- Test the subscription system
-- First, let's see what users and invoices we have

-- Check users
SELECT id, email FROM auth.users LIMIT 3;

-- Check invoices
SELECT user_email, status, package_tier, billing_period_end, paid_at 
FROM invoices 
ORDER BY paid_at DESC 
LIMIT 5;

-- Test the database function with a real email
-- Replace 'test@example.com' with an actual email from your users
SELECT * FROM check_user_subscription_status('test@example.com');

-- Test the edge function (you'll need to replace the URL and user_id)
-- This calls your check_subscription edge function
SELECT 
  body::json as response
FROM net.http_post(
  url := 'https://your-project-ref.supabase.co/functions/v1/check_subscription',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer your-anon-key"}',
  body := '{"user_id": "your-user-id-here"}'
); 