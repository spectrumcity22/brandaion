-- Simple fix for format_ai_request function
-- This updates the function to use the correct column name

CREATE OR REPLACE FUNCTION public.format_ai_request()
RETURNS TRIGGER AS $$
DECLARE
    config_record RECORD;
    json_string TEXT;
BEGIN
    -- Get the client configuration for this user
    SELECT * INTO config_record
    FROM client_configuration 
    WHERE auth_user_id = NEW.auth_user_id
    LIMIT 1;

    -- Build the JSON string
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

    NEW.ai_request_for_questions := json_string;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the function was updated
SELECT 
    'Function Updated Successfully' as status,
    p.proname as function_name,
    CASE WHEN p.proname IS NOT NULL THEN '✅ Updated' ELSE '❌ Failed' END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'format_ai_request'; 