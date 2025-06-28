-- Modified format_ai_request function to remove organisationContext
-- This removes the organisationContext field from ai_request_for_questions

-- Create the modified function
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

    -- Build the JSON string (REMOVED organisationContext)
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
            '"productContext": ' || COALESCE(config_record.schema_json::text, 'null') ||
            '}';
    ELSE
        -- No client configuration found - create basic request (REMOVED organisationContext)
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
            '"productContext": null' ||
            '}';
        
        -- Log that we're using fallback data
        RAISE NOTICE 'No client_configuration found for auth_user_id: %. Using fallback data.', NEW.auth_user_id;
    END IF;

    NEW.ai_request_for_questions := json_string;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the function was updated
SELECT 
    'Function Updated' as check_type,
    p.proname as function_name,
    '✅ format_ai_request function updated to remove organisationContext' as status
FROM pg_proc p
WHERE p.proname = 'format_ai_request';

-- Note: The existing trigger will automatically use the updated function
-- No need to recreate the trigger since we only modified the function 