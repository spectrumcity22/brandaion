-- Safe test of the trigger function - NO DESTRUCTIVE OPERATIONS
-- This will verify that the format_ai_request function is working

-- First, let's get a sample auth_user_id and client_configuration to work with
SELECT 
    'Sample Data Check' as check_type,
    cc.auth_user_id,
    cc.market_name,
    cc.product_name,
    cc.audience_name,
    CASE 
        WHEN cc.brand_jsonld_object IS NOT NULL THEN 'Has brand data'
        ELSE 'No brand data'
    END as brand_status,
    CASE 
        WHEN cc.schema_json IS NOT NULL THEN 'Has schema data'
        ELSE 'No schema data'
    END as schema_status,
    CASE 
        WHEN cc.organisation_jsonld_object IS NOT NULL THEN 'Has org data'
        ELSE 'No org data'
    END as org_status
FROM client_configuration cc
LIMIT 1;

-- Check the current state of records before any changes
SELECT 
    'Current Records Status' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN ai_request_for_questions IS NOT NULL AND ai_request_for_questions != '' THEN 1 END) as records_with_ai_request,
    COUNT(CASE WHEN ai_request_for_questions IS NULL OR ai_request_for_questions = '' THEN 1 END) as records_without_ai_request
FROM construct_faq_pairs;

-- Show a sample of existing records to see their current state
SELECT 
    'Sample Existing Records' as check_type,
    id,
    auth_user_id,
    organisation,
    batch_date,
    CASE 
        WHEN ai_request_for_questions IS NULL THEN 'NULL'
        WHEN ai_request_for_questions = '' THEN 'EMPTY'
        ELSE 'HAS DATA'
    END as ai_request_status,
    LEFT(ai_request_for_questions, 100) as ai_request_preview
FROM construct_faq_pairs 
LIMIT 3;

-- Test the function manually without inserting anything
-- This will show us what the function would produce
DO $$
DECLARE
    test_auth_user_id UUID;
    test_organisation TEXT := 'Test Organisation';
    test_batch_date DATE := CURRENT_DATE;
    test_batch_cluster TEXT := 'TEST-BATCH-001';
    test_batch_id UUID := gen_random_uuid();
    test_faq_pairs INTEGER := 5;
    test_email TEXT := 'test@example.com';
    result_json TEXT;
BEGIN
    -- Get a sample auth_user_id
    SELECT auth_user_id INTO test_auth_user_id
    FROM client_configuration 
    LIMIT 1;
    
    IF test_auth_user_id IS NULL THEN
        RAISE NOTICE 'No client_configuration found to test with';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Testing function with auth_user_id: %', test_auth_user_id;
    
    -- Test what the function would produce
    SELECT 
        '{' ||
        '"batchDispatchDate": "' || TO_CHAR(test_batch_date, 'DD/MM/YYYY') || '",' ||
        '"batchNo": "' || test_batch_cluster || '",' ||
        '"uniqueBatchId": "' || test_batch_id || '",' ||
        '"faqCountInBatch": ' || test_faq_pairs || ',' ||
        '"email": "' || test_email || '",' ||
        '"brand": "' || test_organisation || '",' ||
        '"industry": "' || COALESCE(cc.market_name, 'Unknown') || '",' ||
        '"subCategory": "' || COALESCE(cc.product_name, 'Unknown') || '",' ||
        '"audience": "' || COALESCE(cc.audience_name, 'Unknown') || '",' ||
        '"brandContext": ' || COALESCE(cc.brand_jsonld_object::text, 'null') || ',' ||
        '"productContext": ' || COALESCE(cc.schema_json::text, 'null') || ',' ||
        '"organisationContext": ' || COALESCE(cc.organisation_jsonld_object::text, 'null') ||
        '}' INTO result_json
    FROM client_configuration cc
    WHERE cc.auth_user_id = test_auth_user_id;
    
    RAISE NOTICE 'Function would produce: %', result_json;
    
    IF result_json IS NOT NULL AND result_json != '' THEN
        RAISE NOTICE '✅ SUCCESS: Function can generate valid JSON!';
    ELSE
        RAISE NOTICE '❌ FAILED: Function cannot generate JSON';
    END IF;
    
END $$; 