-- Update invoices table schema to support new webhook processing
-- Add missing columns if they don't exist

-- Add stripe_subscription_id if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'stripe_subscription_id'
    ) THEN
        ALTER TABLE invoices ADD COLUMN stripe_subscription_id VARCHAR(255);
        RAISE NOTICE 'Added stripe_subscription_id column';
    ELSE
        RAISE NOTICE 'stripe_subscription_id column already exists';
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
        RAISE NOTICE 'Added billing_period_start column';
    ELSE
        RAISE NOTICE 'billing_period_start column already exists';
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
        RAISE NOTICE 'Added billing_period_end column';
    ELSE
        RAISE NOTICE 'billing_period_end column already exists';
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
        RAISE NOTICE 'Added package_tier column';
    ELSE
        RAISE NOTICE 'package_tier column already exists';
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
        RAISE NOTICE 'Added faq_pairs_pm column';
    ELSE
        RAISE NOTICE 'faq_pairs_pm column already exists';
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
        RAISE NOTICE 'Added faq_per_batch column';
    ELSE
        RAISE NOTICE 'faq_per_batch column already exists';
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
        RAISE NOTICE 'Added status column';
    ELSE
        RAISE NOTICE 'status column already exists';
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
        RAISE NOTICE 'Added sent_to_schedule column';
    ELSE
        RAISE NOTICE 'sent_to_schedule column already exists';
    END IF;
END $$;

-- Verify all columns exist
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'invoices'
ORDER BY ordinal_position; 