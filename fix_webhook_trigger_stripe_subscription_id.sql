-- First, add the missing stripe_subscription_id column to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'invoices' AND column_name = 'stripe_subscription_id';

-- Now let's manually process the unprocessed webhooks to test
UPDATE stripe_webhook_log 
SET processed = true 
WHERE id IN ('evt_1RdC5ERvWgSPtSJg8yB0p6H2', 'evt_1RXHdKRvWgSPtSJgG4ZnGS56');

-- Check if invoices were created
SELECT 
    id,
    user_email,
    amount_cents,
    stripe_payment_id,
    stripe_subscription_id,
    created_at
FROM invoices 
ORDER BY created_at DESC 
LIMIT 5; 