-- Add missing stripe_subscription_id column to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'invoices' AND column_name = 'stripe_subscription_id'; 