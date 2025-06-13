-- Add billing period columns to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS billing_period_start timestamp with time zone,
ADD COLUMN IF NOT EXISTS billing_period_end timestamp with time zone; 