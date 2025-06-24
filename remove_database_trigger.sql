-- Remove the database trigger since we're using edge function for processing
-- This prevents conflicts between database trigger and edge function

-- Drop the trigger and function
DROP TRIGGER IF EXISTS tr_process_stripe_webhook ON stripe_webhook_log;
DROP FUNCTION IF EXISTS process_stripe_webhook CASCADE;

-- Verify the trigger is removed
SELECT 
    'Database Trigger Status' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_trigger 
            WHERE tgname = 'tr_process_stripe_webhook'
        ) THEN '❌ Trigger still exists'
        ELSE '✅ Trigger removed successfully'
    END as status;

-- Check if function still exists
SELECT 
    'Database Function Status' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' 
            AND p.proname = 'process_stripe_webhook'
        ) THEN '❌ Function still exists'
        ELSE '✅ Function removed successfully'
    END as status;

-- Test the function
SELECT generate_platform_index(); 