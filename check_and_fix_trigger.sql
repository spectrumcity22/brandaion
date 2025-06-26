-- Check if the format_ai_request trigger exists and create it if needed

-- First, check if the trigger exists
SELECT 
    'Trigger Status Check' as check_type,
    t.tgname as trigger_name,
    t.tgenabled as trigger_enabled,
    p.proname as function_name,
    CASE 
        WHEN t.tgname IS NOT NULL THEN '✅ Trigger exists'
        ELSE '❌ Trigger missing'
    END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'construct_faq_pairs' 
  AND t.tgname = 'format_ai_request_trigger';

-- If trigger doesn't exist, create it
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
        
        RAISE NOTICE 'Created format_ai_request_trigger';
    ELSE
        RAISE NOTICE 'Trigger already exists';
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
    END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'construct_faq_pairs' 
  AND t.tgname = 'format_ai_request_trigger';

-- Test the trigger by checking if it fires on a sample insert
-- First, let's see what happens when we try to insert a test record
SELECT 
    'Test Insert Preparation' as check_type,
    'Ready to test trigger with sample data' as message; 