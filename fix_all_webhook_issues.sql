-- Fix all webhook issues
-- 1. First, let's add missing columns to invoices table if they don't exist

-- Add stripe_subscription_id if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'stripe_subscription_id'
    ) THEN
        ALTER TABLE invoices ADD COLUMN stripe_subscription_id VARCHAR(255);
    END IF;
END $$;

-- Add billing_period_start if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'billing_period_start'
    ) THEN
        ALTER TABLE invoices ADD COLUMN billing_period_start TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add billing_period_end if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'billing_period_end'
    ) THEN
        ALTER TABLE invoices ADD COLUMN billing_period_end TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add package_tier if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'package_tier'
    ) THEN
        ALTER TABLE invoices ADD COLUMN package_tier VARCHAR(255) DEFAULT 'Startup';
    END IF;
END $$;

-- Add faq_pairs_pm if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'faq_pairs_pm'
    ) THEN
        ALTER TABLE invoices ADD COLUMN faq_pairs_pm INTEGER DEFAULT 20;
    END IF;
END $$;

-- Add faq_per_batch if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'faq_per_batch'
    ) THEN
        ALTER TABLE invoices ADD COLUMN faq_per_batch INTEGER DEFAULT 5;
    END IF;
END $$;

-- Add status if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE invoices ADD COLUMN status VARCHAR(50) DEFAULT 'active';
    END IF;
END $$;

-- Add sent_to_schedule if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'sent_to_schedule'
    ) THEN
        ALTER TABLE invoices ADD COLUMN sent_to_schedule BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Update the webhook trigger function to handle both event types properly
DROP TRIGGER IF EXISTS tr_process_stripe_webhook ON stripe_webhook_log;
DROP FUNCTION IF EXISTS process_stripe_webhook CASCADE;

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
    
    -- For checkout sessions, we need to calculate billing periods
    -- Assuming monthly billing, set period start to now and end to 1 month from now
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER tr_process_stripe_webhook
    AFTER INSERT ON stripe_webhook_log
    FOR EACH ROW
    EXECUTE FUNCTION process_stripe_webhook();

-- 3. Process the existing unprocessed webhook
UPDATE stripe_webhook_log 
SET processed = false 
WHERE payload->>'type' = 'checkout.session.completed' 
  AND processed = true
  AND payload->'data'->'object'->>'id' = 'cs_test_a1HrUCMEvN2XB4J2B5UMLZrWOspuMVYN2ly55bUVT13gIWXVGSlkeNjRMb';

-- 4. Verify the fix worked
SELECT 
    'Schema Check' as check_type,
    COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'invoices';

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