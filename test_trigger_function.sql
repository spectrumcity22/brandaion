-- Test the trigger by inserting a sample record
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

-- Now let's create a test record to see if the trigger works
-- We'll use a test auth_user_id and see if ai_request_for_questions gets populated
DO $$
DECLARE
    test_auth_user_id UUID;
    test_record_id UUID;
    ai_request_result TEXT;
BEGIN
    -- Get a sample auth_user_id
    SELECT auth_user_id INTO test_auth_user_id
    FROM client_configuration 
    LIMIT 1;
    
    IF test_auth_user_id IS NULL THEN
        RAISE NOTICE 'No client_configuration found to test with';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Testing with auth_user_id: %', test_auth_user_id;
    
    -- Insert a test record
    INSERT INTO construct_faq_pairs (
        auth_user_id,
        organisation,
        batch_date,
        unique_batch_cluster,
        unique_batch_id,
        batch_faq_pairs,
        user_email,
        timestamp
    ) VALUES (
        test_auth_user_id,
        'Test Organisation',
        CURRENT_DATE,
        'TEST-BATCH-001',
        gen_random_uuid(),
        5,
        'test@example.com',
        NOW()
    ) RETURNING id, ai_request_for_questions INTO test_record_id, ai_request_result;
    
    RAISE NOTICE 'Inserted test record with ID: %', test_record_id;
    RAISE NOTICE 'AI Request Result: %', ai_request_result;
    
    -- Check if ai_request_for_questions was populated
    IF ai_request_result IS NOT NULL AND ai_request_result != '' THEN
        RAISE NOTICE '✅ SUCCESS: ai_request_for_questions was populated!';
    ELSE
        RAISE NOTICE '❌ FAILED: ai_request_for_questions is still null/empty';
    END IF;
    
    -- Clean up the test record
    DELETE FROM construct_faq_pairs WHERE id = test_record_id;
    RAISE NOTICE 'Cleaned up test record';
    
END $$;

-- Check the current state of records
SELECT 
    'Current Records Status' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN ai_request_for_questions IS NOT NULL AND ai_request_for_questions != '' THEN 1 END) as records_with_ai_request,
    COUNT(CASE WHEN ai_request_for_questions IS NULL OR ai_request_for_questions = '' THEN 1 END) as records_without_ai_request
FROM construct_faq_pairs; 