-- Rollback: Remove the problematic trigger and function
DROP TRIGGER IF EXISTS tr_process_stripe_webhook ON stripe_webhook_log;
DROP FUNCTION IF EXISTS process_stripe_webhook CASCADE;

-- Verify the trigger is gone
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'tr_process_stripe_webhook';

-- Check what webhooks are stored but unprocessed
SELECT 
    id,
    type,
    processed,
    created_at
FROM stripe_webhook_log 
WHERE processed = false
ORDER BY created_at DESC; 