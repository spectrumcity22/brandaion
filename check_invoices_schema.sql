-- Check the current invoices table schema
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'invoices'
ORDER BY ordinal_position;

-- Check if stripe_subscription_id column exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'invoices' 
            AND column_name = 'stripe_subscription_id'
        ) THEN '✅ stripe_subscription_id exists'
        ELSE '❌ stripe_subscription_id missing'
    END as stripe_subscription_id_status;

-- Check if billing_period_start and billing_period_end exist
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'invoices' 
            AND column_name = 'billing_period_start'
        ) THEN '✅ billing_period_start exists'
        ELSE '❌ billing_period_start missing'
    END as billing_period_start_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'invoices' 
            AND column_name = 'billing_period_end'
        ) THEN '✅ billing_period_end exists'
        ELSE '❌ billing_period_end missing'
    END as billing_period_end_status;

-- Check if package_tier, faq_pairs_pm, faq_per_batch exist
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'invoices' 
            AND column_name = 'package_tier'
        ) THEN '✅ package_tier exists'
        ELSE '❌ package_tier missing'
    END as package_tier_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'invoices' 
            AND column_name = 'faq_pairs_pm'
        ) THEN '✅ faq_pairs_pm exists'
        ELSE '❌ faq_pairs_pm missing'
    END as faq_pairs_pm_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'invoices' 
            AND column_name = 'faq_per_batch'
        ) THEN '✅ faq_per_batch exists'
        ELSE '❌ faq_per_batch missing'
    END as faq_per_batch_status; 