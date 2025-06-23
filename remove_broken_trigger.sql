-- Remove the broken trigger that's causing the crypto schema error
DROP TRIGGER IF EXISTS tr_process_stripe_webhook ON stripe_webhook_log;
DROP FUNCTION IF EXISTS process_stripe_webhook CASCADE;

-- Verify the trigger is gone
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'tr_process_stripe_webhook';

-- Now webhooks will be stored but not automatically processed
-- You can manually process them later or fix the trigger properly 