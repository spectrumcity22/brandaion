-- Make auth_user_id nullable
ALTER TABLE invoices ALTER COLUMN auth_user_id DROP NOT NULL;

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS tr_set_billing_periods ON invoices;
DROP FUNCTION IF EXISTS set_billing_periods();

-- Create function to set billing periods
CREATE OR REPLACE FUNCTION set_billing_periods()
RETURNS TRIGGER AS $$
BEGIN
    -- Set billing periods based on paid_at
    NEW.billing_period_start := NEW.paid_at;
    NEW.billing_period_end := NEW.paid_at + INTERVAL '1 month';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set billing periods before insert
CREATE TRIGGER tr_set_billing_periods
    BEFORE INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION set_billing_periods(); 