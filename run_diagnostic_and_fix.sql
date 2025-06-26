-- Comprehensive diagnostic and fix for format_ai_request trigger

-- 1. Check current trigger status
SELECT 
    'Current Trigger Status' as check_type,
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    CASE WHEN t.tgenabled = 'O' THEN 'Enabled' ELSE 'Disabled' END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'construct_faq_pairs'
  AND p.proname = 'format_ai_request';

-- 2. Check current records
SELECT 
    'Current Records Status' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN ai_request_for_questions IS NOT NULL THEN 1 END) as with_ai_request,
    COUNT(CASE WHEN ai_request_for_questions IS NULL THEN 1 END) as missing_ai_request
FROM construct_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- 3. Show sample of records missing ai_request_for_questions
SELECT 
    'Records Missing AI Request' as check_type,
    id,
    unique_batch_id,
    organisation,
    question_status,
    ai_request_for_questions IS NULL as missing_ai_request
FROM construct_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND ai_request_for_questions IS NULL
LIMIT 3;

-- 4. Now apply the fix
-- Drop any existing trigger
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

-- 5. Verify trigger was created
SELECT 
    'Trigger Created Successfully' as status,
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    CASE WHEN t.tgenabled = 'O' THEN 'Enabled' ELSE 'Disabled' END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'construct_faq_pairs'
  AND p.proname = 'format_ai_request';

-- 6. Update existing records that don't have ai_request_for_questions
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

-- 7. Final verification
SELECT 
    'Final Status' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN ai_request_for_questions IS NOT NULL THEN 1 END) as with_ai_request,
    COUNT(CASE WHEN ai_request_for_questions IS NULL THEN 1 END) as missing_ai_request
FROM construct_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- 8. Show sample of updated records
SELECT 
    'Sample Updated Records' as check_type,
    id,
    unique_batch_id,
    LEFT(ai_request_for_questions, 100) as ai_request_preview,
    question_status
FROM construct_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND ai_request_for_questions IS NOT NULL
ORDER BY timestamp DESC
LIMIT 3; 