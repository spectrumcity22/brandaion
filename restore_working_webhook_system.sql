-- Remove the problematic trigger that's causing all the errors
DROP TRIGGER IF EXISTS tr_process_stripe_webhook ON stripe_webhook_log;
DROP FUNCTION IF EXISTS process_stripe_webhook CASCADE;

-- Keep the auth_user_id trigger (this one works)
-- DROP TRIGGER IF EXISTS tr_set_invoice_auth_user ON invoices;
-- DROP FUNCTION IF EXISTS set_invoice_auth_user CASCADE;

-- Verify the problematic trigger is gone
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'tr_process_stripe_webhook';

-- Now webhooks will be stored but not automatically processed
-- You can manually process them later or fix the trigger properly 