-- Create a more robust version of the format_ai_request trigger
-- This handles potential timing issues and data availability problems

-- Drop the existing trigger
DROP TRIGGER IF EXISTS format_ai_request_trigger ON construct_faq_pairs;

-- Create a more robust function
CREATE OR REPLACE FUNCTION public.format_ai_request()
RETURNS TRIGGER AS $$
DECLARE
    config_record RECORD;
    json_string TEXT;
    retry_count INTEGER := 0;
    max_retries INTEGER := 3;
BEGIN
    -- Try to get client configuration with retry logic
    LOOP
        SELECT * INTO config_record
        FROM client_configuration 
        WHERE auth_user_id = NEW.auth_user_id
        LIMIT 1;
        
        -- If we found the config or hit max retries, break
        IF FOUND OR retry_count >= max_retries THEN
            EXIT;
        END IF;
        
        -- Wait a bit and retry (in case of timing issues)
        PERFORM pg_sleep(0.1);
        retry_count := retry_count + 1;
    END LOOP;

    -- Build the JSON string
    IF FOUND THEN
        -- We have client configuration data
        json_string := '{' ||
            '"batchDispatchDate": "' || TO_CHAR(NEW.batch_date, 'DD/MM/YYYY') || '",' ||
            '"batchNo": "' || NEW.unique_batch_cluster || '",' ||
            '"uniqueBatchId": "' || NEW.unique_batch_id || '",' ||
            '"faqCountInBatch": ' || NEW.batch_faq_pairs || ',' ||
            '"email": "' || NEW.user_email || '",' ||
            '"brand": "' || NEW.organisation || '",' ||
            '"industry": "' || COALESCE(config_record.market_name, 'Unknown') || '",' ||
            '"subCategory": "' || COALESCE(config_record.product_name, 'Unknown') || '",' ||
            '"audience": "' || COALESCE(config_record.audience_name, 'Unknown') || '",' ||
            '"brandContext": ' || COALESCE(config_record.brand_jsonld_object::text, 'null') || ',' ||
            '"productContext": ' || COALESCE(config_record.schema_json::text, 'null') || ',' ||
            '"organisationContext": ' || COALESCE(config_record.organisation_jsonld_object::text, 'null') ||
            '}';
    ELSE
        -- No client configuration found - create basic request
        json_string := '{' ||
            '"batchDispatchDate": "' || TO_CHAR(NEW.batch_date, 'DD/MM/YYYY') || '",' ||
            '"batchNo": "' || NEW.unique_batch_cluster || '",' ||
            '"uniqueBatchId": "' || NEW.unique_batch_id || '",' ||
            '"faqCountInBatch": ' || NEW.batch_faq_pairs || ',' ||
            '"email": "' || NEW.user_email || '",' ||
            '"brand": "' || NEW.organisation || '",' ||
            '"industry": "Unknown",' ||
            '"subCategory": "Unknown",' ||
            '"audience": "Unknown",' ||
            '"brandContext": null,' ||
            '"productContext": null,' ||
            '"organisationContext": null' ||
            '}';
        
        -- Log that we're using fallback data
        RAISE NOTICE 'No client_configuration found for auth_user_id: %. Using fallback data.', NEW.auth_user_id;
    END IF;

    NEW.ai_request_for_questions := json_string;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER format_ai_request_trigger
    BEFORE INSERT ON construct_faq_pairs
    FOR EACH ROW
    EXECUTE FUNCTION format_ai_request();

-- Verify the trigger was created
SELECT 
    'Robust Trigger Created' as check_type,
    t.tgname as trigger_name,
    t.tgenabled as trigger_enabled,
    p.proname as function_name,
    CASE 
        WHEN t.tgname IS NOT NULL THEN '✅ Trigger exists and is enabled'
        ELSE '❌ Trigger missing'
    END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'construct_faq_pairs' 
  AND t.tgname = 'format_ai_request_trigger'; 