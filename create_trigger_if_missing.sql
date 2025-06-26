-- Create the format_ai_request trigger if it doesn't exist

-- First, check if trigger exists
SELECT 
    'Trigger Status Before Creation' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_trigger t
            JOIN pg_class c ON t.tgrelid = c.oid
            WHERE c.relname = 'construct_faq_pairs' 
              AND t.tgname = 'format_ai_request_trigger'
        ) THEN '✅ Trigger already exists'
        ELSE '❌ Trigger missing - will create'
    END as status;

-- Create the trigger if it doesn't exist
DO $$
BEGIN
    -- Check if trigger exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname = 'construct_faq_pairs' 
          AND t.tgname = 'format_ai_request_trigger'
    ) THEN
        -- Create the trigger
        CREATE TRIGGER format_ai_request_trigger
        BEFORE INSERT ON construct_faq_pairs
        FOR EACH ROW
        EXECUTE FUNCTION format_ai_request();
        
        RAISE NOTICE '✅ Successfully created format_ai_request_trigger';
    ELSE
        RAISE NOTICE 'ℹ️ Trigger already exists';
    END IF;
END $$;

-- Verify the trigger was created
SELECT 
    'Trigger Creation Verification' as check_type,
    t.tgname as trigger_name,
    t.tgenabled as trigger_enabled,
    p.proname as function_name,
    CASE 
        WHEN t.tgname IS NOT NULL THEN '✅ Trigger exists and is enabled'
        ELSE '❌ Trigger still missing'
    END as status,
    CASE t.tgenabled
        WHEN 'O' THEN 'Enabled'
        WHEN 'D' THEN 'Disabled'
        WHEN 'R' THEN 'Replica'
        ELSE 'Unknown'
    END as enabled_status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'construct_faq_pairs' 
  AND t.tgname = 'format_ai_request_trigger';

-- Show all triggers on the table for verification
SELECT 
    'All Triggers on construct_faq_pairs' as check_type,
    t.tgname as trigger_name,
    t.tgenabled as trigger_enabled,
    p.proname as function_name,
    CASE t.tgtype & 66
        WHEN 2 THEN 'BEFORE'
        WHEN 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
    END as trigger_timing,
    CASE t.tgtype & 28
        WHEN 4 THEN 'INSERT'
        WHEN 8 THEN 'DELETE'
        WHEN 16 THEN 'UPDATE'
        WHEN 12 THEN 'INSERT OR DELETE'
        WHEN 20 THEN 'INSERT OR UPDATE'
        WHEN 24 THEN 'DELETE OR UPDATE'
        WHEN 28 THEN 'INSERT OR DELETE OR UPDATE'
    END as trigger_events
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'construct_faq_pairs'; 