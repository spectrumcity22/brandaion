-- Review the current webhook trigger function
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'process_stripe_webhook';

-- Check if the trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'tr_process_stripe_webhook';

-- Check invoices table structure to see what columns actually exist
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'invoices' 
ORDER BY ordinal_position;

-- Check if stripe_subscription_id column exists in invoices
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' 
    AND column_name = 'stripe_subscription_id'
) as stripe_subscription_id_exists;

-- Check recent webhook logs to see what's being stored
SELECT 
    id,
    type,
    processed,
    created_at
FROM stripe_webhook_log 
ORDER BY created_at DESC 
LIMIT 5;

-- Check if there are any recent errors in the logs
SELECT 
    id,
    type,
    processed,
    created_at,
    payload->>'type' as payload_type
FROM stripe_webhook_log 
WHERE processed = false
ORDER BY created_at DESC; 