-- Create cron job for automated monthly FAQ testing
-- This will run daily at 2 AM UTC to check for users who need testing

-- First, make sure we have the last_test_month field in user_monthly_schedule
-- (This should already exist from the migration, but let's make sure)

-- Create the cron job
SELECT cron.schedule(
  'run-monthly-faq-tests',
  '0 2 * * *', -- Daily at 2 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/run_monthly_faq_tests',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer your-service-role-key"}',
    body := '{}'
  );
  $$
);

-- Verify the cron job was created
SELECT * FROM cron.job WHERE command LIKE '%run_monthly_faq_tests%'; 