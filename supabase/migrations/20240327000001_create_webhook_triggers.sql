-- Drop any existing triggers and functions
DROP TRIGGER IF EXISTS tr_process_stripe_webhook ON stripe_webhook_log;
DROP TRIGGER IF EXISTS tr_set_invoice_auth_user ON invoices;
DROP FUNCTION IF EXISTS process_stripe_webhook CASCADE;
DROP FUNCTION IF EXISTS set_invoice_auth_user CASCADE;

-- Create function to process stripe webhooks
CREATE OR REPLACE FUNCTION process_stripe_webhook()
RETURNS TRIGGER AS $$
DECLARE
  session jsonb;
  invoice_id text;
  package_data record;
  user_email text;
BEGIN
  -- Only process invoice.paid events
  IF NEW.payload->>'type' != 'invoice.paid' THEN
    RETURN NEW;
  END IF;

  session := NEW.payload -> 'data' -> 'object';
  invoice_id := session ->> 'id';
  user_email := session ->> 'customer_email';

  -- Get package details based on amount
  SELECT * INTO package_data
  FROM packages
  WHERE amount_cents = (session ->> 'amount_paid')::integer;

  -- Create invoice
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
    (session ->> 'amount_paid')::integer,
    invoice_id,
    session ->> 'subscription',
    to_timestamp((session ->> 'period_start')::integer),
    to_timestamp((session ->> 'period_end')::integer),
    to_timestamp((session ->> 'created')::integer),
    'active',
    package_data.tier,
    package_data.faq_pairs_pm,
    package_data.faq_per_batch,
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

-- Create function to set auth_user_id on invoices
CREATE OR REPLACE FUNCTION set_invoice_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    found_auth_user_id UUID;
BEGIN
    -- Look up the auth_user_id from end_users table using the email
    SELECT auth_user_id INTO found_auth_user_id
    FROM end_users
    WHERE email = NEW.user_email
    LIMIT 1;

    -- If we found a matching user, set the auth_user_id
    IF found_auth_user_id IS NOT NULL THEN
        NEW.auth_user_id := found_auth_user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to process stripe webhooks
CREATE TRIGGER tr_process_stripe_webhook
    AFTER INSERT ON stripe_webhook_log
    FOR EACH ROW
    EXECUTE FUNCTION process_stripe_webhook();

-- Create trigger to set auth_user_id on invoices
CREATE TRIGGER tr_set_invoice_auth_user
    BEFORE INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION set_invoice_auth_user(); 