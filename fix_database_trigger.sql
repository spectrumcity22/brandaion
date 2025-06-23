-- Fix the database trigger to handle both invoice.paid and checkout.session.completed events
-- This will process webhooks automatically as soon as they're stored

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS tr_process_stripe_webhook ON stripe_webhook_log;
DROP FUNCTION IF EXISTS process_stripe_webhook CASCADE;

-- Create updated function to process both event types
CREATE OR REPLACE FUNCTION process_stripe_webhook()
RETURNS TRIGGER AS $$
DECLARE
  session jsonb;
  invoice_id text;
  package_data record;
  user_email text;
  amount_cents integer;
  stripe_payment_id text;
  stripe_subscription_id text;
  paid_at timestamp with time zone;
  billing_period_start timestamp with time zone;
  billing_period_end timestamp with time zone;
BEGIN
  -- Process both invoice.paid and checkout.session.completed events
  IF NEW.payload->>'type' NOT IN ('invoice.paid', 'checkout.session.completed') THEN
    RETURN NEW;
  END IF;

  session := NEW.payload -> 'data' -> 'object';
  
  -- Handle different event types
  IF NEW.payload->>'type' = 'invoice.paid' THEN
    -- Invoice paid event
    invoice_id := session ->> 'id';
    user_email := session ->> 'customer_email';
    amount_cents := (session ->> 'amount_paid')::integer;
    stripe_payment_id := session ->> 'id';
    stripe_subscription_id := session ->> 'subscription';
    paid_at := to_timestamp((session ->> 'created')::integer);
    billing_period_start := to_timestamp((session ->> 'period_start')::integer);
    billing_period_end := to_timestamp((session ->> 'period_end')::integer);
  ELSIF NEW.payload->>'type' = 'checkout.session.completed' THEN
    -- Checkout session completed event
    invoice_id := crypto.random_uuid()::text;
    user_email := session -> 'customer_details' ->> 'email';
    amount_cents := (session ->> 'amount_total')::integer;
    stripe_payment_id := session ->> 'id';
    stripe_subscription_id := session ->> 'subscription';
    paid_at := to_timestamp((session ->> 'created')::integer);
    
    -- For checkout sessions, calculate billing periods (monthly)
    billing_period_start := to_timestamp((session ->> 'created')::integer);
    billing_period_end := billing_period_start + interval '1 month';
  END IF;

  -- Get package details based on amount
  SELECT * INTO package_data
  FROM packages
  WHERE amount_cents = amount_cents;

  -- Create invoice with all required fields
  INSERT INTO invoices (
    id,
    user_email,
    amount_cents,
    stripe_payment_id,
    stripe_subscription_id,
    billing_period_start,
    billing_period_end,
    paid_at,
    status,
    package_tier,
    faq_pairs_pm,
    faq_per_batch,
    inserted_at,
    sent_to_schedule
  ) VALUES (
    invoice_id,
    user_email,
    amount_cents,
    stripe_payment_id,
    stripe_subscription_id,
    billing_period_start,
    billing_period_end,
    paid_at,
    'active',
    COALESCE(package_data.tier, 'Startup'),
    COALESCE(package_data.faq_pairs_pm, 20),
    COALESCE(package_data.faq_per_batch, 5),
    NOW(),
    false
  );

  -- Mark webhook as processed
  UPDATE stripe_webhook_log
  SET processed = true
  WHERE id = NEW.id;

  -- Log successful processing
  RAISE NOTICE 'Processed % event for user % with amount % cents', 
    NEW.payload->>'type', user_email, amount_cents;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER tr_process_stripe_webhook
    AFTER INSERT ON stripe_webhook_log
    FOR EACH ROW
    EXECUTE FUNCTION process_stripe_webhook();

-- Verify the trigger is created
SELECT 
    'Database Trigger Status' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_trigger 
            WHERE tgname = 'tr_process_stripe_webhook'
        ) THEN '✅ Trigger created successfully'
        ELSE '❌ Trigger creation failed'
    END as status;

-- Test the fix by processing the existing failed webhook
UPDATE stripe_webhook_log 
SET processed = false 
WHERE payload->>'type' = 'checkout.session.completed' 
  AND processed = true
  AND payload->'data'->'object'->>'id' = 'cs_test_a1HrUCMEvN2XB4J2B5UMLZrWOspuMVYN2ly55bUVT13gIWXVGSlkeNjRMb';

-- Verify the fix worked
SELECT 
    'Webhook Status' as check_type,
    COUNT(*) as total_webhooks,
    COUNT(CASE WHEN processed = true THEN 1 END) as processed_webhooks,
    COUNT(CASE WHEN processed = false THEN 1 END) as unprocessed_webhooks
FROM stripe_webhook_log;

SELECT 
    'Invoice Status' as check_type,
    COUNT(*) as total_invoices,
    COUNT(CASE WHEN stripe_payment_id = 'cs_test_a1HrUCMEvN2XB4J2B5UMLZrWOspuMVYN2ly55bUVT13gIWXVGSlkeNjRMb' THEN 1 END) as matching_invoices
FROM invoices; 