-- Drop existing trigger and function
DROP TRIGGER IF EXISTS tr_process_stripe_webhook ON stripe_webhook_log;
DROP FUNCTION IF EXISTS process_stripe_webhook CASCADE;

-- Create fixed function to process stripe webhooks
CREATE OR REPLACE FUNCTION process_stripe_webhook()
RETURNS TRIGGER AS $$
DECLARE
  session jsonb;
  invoice_id text;
  package_data record;
  user_email text;
  amount_cents integer;
  stripe_payment_id text;
  paid_at timestamp with time zone;
  billing_period_start timestamp with time zone;
  billing_period_end timestamp with time zone;
BEGIN
  -- Process both invoice.paid and checkout.session.completed events
  IF NEW.type NOT IN ('invoice.paid', 'checkout.session.completed') THEN
    RETURN NEW;
  END IF;

  session := NEW.payload -> 'data' -> 'object';
  
  -- Handle different event types
  IF NEW.type = 'invoice.paid' THEN
    -- Invoice paid event
    invoice_id := session ->> 'id';
    user_email := session ->> 'customer_email';
    amount_cents := (session ->> 'amount_paid')::integer;
    stripe_payment_id := session ->> 'id';
    paid_at := to_timestamp((session ->> 'created')::integer);
    billing_period_start := to_timestamp((session ->> 'period_start')::integer);
    billing_period_end := to_timestamp((session ->> 'period_end')::integer);
  ELSIF NEW.type = 'checkout.session.completed' THEN
    -- Checkout session completed event
    invoice_id := crypto.random_uuid()::text;
    user_email := session -> 'customer_details' ->> 'email';
    amount_cents := (session ->> 'amount_total')::integer;
    stripe_payment_id := session ->> 'id';
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

  -- Create invoice using only existing columns
  INSERT INTO invoices (
    id,
    user_email,
    amount_cents,
    stripe_payment_id,
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