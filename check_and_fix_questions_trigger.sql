-- Check and fix the questions generation trigger
-- This trigger should fire AFTER INSERT to generate questions

-- First, check all current triggers on construct_faq_pairs
SELECT 
    'All Triggers on construct_faq_pairs' as check_type,
    t.tgname as trigger_name,
    t.tgenabled as trigger_enabled,
    p.proname as function_name,
    CASE t.tgtype & 66
        WHEN 2 THEN 'BEFORE'
        WHEN 64 THEN 'AFTER'
        ELSE 'INSTEAD OF'
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
WHERE c.relname = 'construct_faq_pairs'
ORDER BY t.tgname;

-- Specifically check for the questions generation trigger
SELECT 
    'Questions Generation Trigger Check' as check_type,
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
  AND t.tgname = 'tr_generate_questions';

-- Check if the trigger_generate_questions function exists
SELECT 
    'Function Check' as check_type,
    p.proname as function_name,
    CASE 
        WHEN p.proname IS NOT NULL THEN '✅ Function exists'
        ELSE '❌ Function missing'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'trigger_generate_questions';

-- Create or update the trigger_generate_questions function
CREATE OR REPLACE FUNCTION public.trigger_generate_questions()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the Edge Function asynchronously
  PERFORM
    net.http_post(
      url := 'https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/open_ai_request_questions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('batchId', NEW.unique_batch_id)
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger if it doesn't exist
DO $$
BEGIN
    -- Check if trigger exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname = 'construct_faq_pairs' 
          AND t.tgname = 'tr_generate_questions'
    ) THEN
        -- Create the trigger
        CREATE TRIGGER tr_generate_questions
        AFTER INSERT ON public.construct_faq_pairs
        FOR EACH ROW
        EXECUTE FUNCTION public.trigger_generate_questions();
        
        RAISE NOTICE '✅ Successfully created tr_generate_questions trigger';
    ELSE
        RAISE NOTICE 'ℹ️ Trigger already exists - function updated';
    END IF;
END $$;

-- Verify the trigger was created/updated
SELECT 
    'Final Trigger Status' as check_type,
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
  AND t.tgname = 'tr_generate_questions'; 