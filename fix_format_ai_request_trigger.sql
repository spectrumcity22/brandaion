-- Fix the format_ai_request trigger to ensure it populates ai_request_for_questions

-- First, drop any existing trigger
DROP TRIGGER IF EXISTS tr_format_ai_request ON public.construct_faq_pairs;

-- Create or replace the format_ai_request function
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
            '","brandContext": ', COALESCE(cc.brand_jsonld_object, 'null'),
            ',"productContext": ', COALESCE(cc.schema_json, 'null'),
            ',"organisationContext": ', COALESCE(cc.organisation_jsonld_object, 'null')
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

-- Create the trigger
CREATE TRIGGER tr_format_ai_request
    BEFORE INSERT ON public.construct_faq_pairs
    FOR EACH ROW
    EXECUTE FUNCTION public.format_ai_request();

-- Verify the trigger was created
SELECT 
    'Trigger Created' as status,
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    CASE WHEN t.tgenabled = 'O' THEN 'Enabled' ELSE 'Disabled' END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'construct_faq_pairs'
  AND p.proname = 'format_ai_request';

-- Update existing records that don't have ai_request_for_questions
UPDATE construct_faq_pairs 
SET ai_request_for_questions = CONCAT(
    '"batchDispatchDate": "', TO_CHAR(batch_date, 'DD/MM/YYYY'),
    '","batchNo": "', unique_batch_cluster,
    '","uniqueBatchId": "', unique_batch_id,
    '","faqCountInBatch": ', batch_faq_pairs,
    ',"email": "', user_email,
    '","brand": "', organisation,
    '","industry": "', COALESCE(cc.market_name, 'Unknown'),
    '","subCategory": "', COALESCE(cc.product_name, 'Unknown'),
    '","audience": "', COALESCE(cc.audience_name, 'Unknown'),
    '","brandContext": ', COALESCE(cc.brand_jsonld_object, 'null'),
    ',"productContext": ', COALESCE(cc.schema_json, 'null'),
    ',"organisationContext": ', COALESCE(cc.organisation_jsonld_object, 'null')
)
FROM client_configuration cc
WHERE construct_faq_pairs.auth_user_id = cc.auth_user_id
  AND construct_faq_pairs.ai_request_for_questions IS NULL;

-- Verify the update worked
SELECT 
    'Updated Records' as status,
    COUNT(*) as updated_count
FROM construct_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND ai_request_for_questions IS NOT NULL; 