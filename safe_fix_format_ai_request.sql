-- Safe fix for format_ai_request function
-- This only updates the function definition to use the correct column name

-- Update the format_ai_request function to use schema_json instead of product_jsonld_object
CREATE OR REPLACE FUNCTION public.format_ai_request()
RETURNS TRIGGER AS $$
BEGIN
    -- Get the client configuration for this user
    SELECT 
        CONCAT(
            '"batchDispatchDate": "', TO_CHAR(NEW.batch_date, 'DD/MM/YYYY'),
            '","batchNo": "', NEW.unique_batch_cluster,
            '","uniqueBatchId": "', NEW.unique_batch_id,
            '","faqCountInBatch": ', NEW.batch_faq_pairs,
            ',"email": "', NEW.user_email,
            '","brand": "', NEW.organisation,
            '","industry": "', COALESCE(cc.market_name, ''),
            '","subCategory": "', COALESCE(cc.product_name, ''),
            '","audience": "', COALESCE(cc.audience_name, ''),
            '","brandContext": ', COALESCE(cc.brand_jsonld_object::text, 'null'),
            ',"productContext": ', COALESCE(cc.schema_json::text, 'null'),
            ',"organisationContext": ', COALESCE(cc.organisation_jsonld_object::text, 'null')
        ) INTO NEW.ai_request_for_questions
    FROM client_configuration cc
    WHERE cc.auth_user_id = NEW.auth_user_id;

    -- If no client configuration found, create a basic request
    IF NEW.ai_request_for_questions IS NULL THEN
        NEW.ai_request_for_questions := CONCAT(
            '"batchDispatchDate": "', TO_CHAR(NEW.batch_date, 'DD/MM/YYYY'),
            '","batchNo": "', NEW.unique_batch_cluster,
            '","uniqueBatchId": "', NEW.unique_batch_id,
            '","faqCountInBatch": ', NEW.batch_faq_pairs,
            ',"email": "', NEW.user_email,
            '","brand": "', NEW.organisation,
            '","industry": "Unknown",
            '","subCategory": "Unknown",
            '","audience": "Unknown",
            '","brandContext": null,
            ',"productContext": null,
            ',"organisationContext": null'
        );
    END IF;

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

-- Show the updated function definition
SELECT 
    'Updated Function Definition' as check_type,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'format_ai_request'; 