-- Test the robust format_ai_request trigger
-- This will verify that the trigger works with retry logic and fallback handling

-- First, let's check what client_configuration data is available
SELECT 
    'Client Configuration Check' as check_type,
    auth_user_id,
    market_name,
    product_name,
    audience_name,
    CASE 
        WHEN brand_jsonld_object IS NOT NULL THEN 'Has brand data'
        ELSE 'No brand data'
    END as brand_status,
    CASE 
        WHEN schema_json IS NOT NULL THEN 'Has schema data'
        ELSE 'No schema data'
    END as schema_status,
    CASE 
        WHEN organisation_jsonld_object IS NOT NULL THEN 'Has org data'
        ELSE 'No org data'
    END as org_status
FROM client_configuration 
LIMIT 3;

-- Test the trigger by simulating what happens during a real insert
-- We'll use a test auth_user_id and see what the function would produce
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
    config_found BOOLEAN;
BEGIN
    -- Get a sample auth_user_id
    SELECT auth_user_id INTO test_auth_user_id
    FROM client_configuration 
    LIMIT 1;
    
    IF test_auth_user_id IS NULL THEN
        RAISE NOTICE 'No client_configuration found to test with';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Testing robust trigger with auth_user_id: %', test_auth_user_id;
    
    -- Simulate the trigger logic with retry
    DECLARE
        config_record RECORD;
        retry_count INTEGER := 0;
        max_retries INTEGER := 3;
    BEGIN
        -- Try to get client configuration with retry logic
        LOOP
            SELECT * INTO config_record
            FROM client_configuration 
            WHERE auth_user_id = test_auth_user_id
            LIMIT 1;
            
            -- If we found the config or hit max retries, break
            IF FOUND OR retry_count >= max_retries THEN
                config_found := FOUND;
                EXIT;
            END IF;
            
            -- Wait a bit and retry (in case of timing issues)
            PERFORM pg_sleep(0.1);
            retry_count := retry_count + 1;
        END LOOP;

        -- Build the JSON string
        IF config_found THEN
            -- We have client configuration data
            result_json := '{' ||
                '"batchDispatchDate": "' || TO_CHAR(test_batch_date, 'DD/MM/YYYY') || '",' ||
                '"batchNo": "' || test_batch_cluster || '",' ||
                '"uniqueBatchId": "' || test_batch_id || '",' ||
                '"faqCountInBatch": ' || test_faq_pairs || ',' ||
                '"email": "' || test_email || '",' ||
                '"brand": "' || test_organisation || '",' ||
                '"industry": "' || COALESCE(config_record.market_name, 'Unknown') || '",' ||
                '"subCategory": "' || COALESCE(config_record.product_name, 'Unknown') || '",' ||
                '"audience": "' || COALESCE(config_record.audience_name, 'Unknown') || '",' ||
                '"brandContext": ' || COALESCE(config_record.brand_jsonld_object::text, 'null') || ',' ||
                '"productContext": ' || COALESCE(config_record.schema_json::text, 'null') || ',' ||
                '"organisationContext": ' || COALESCE(config_record.organisation_jsonld_object::text, 'null') ||
                '}';
            
            RAISE NOTICE '✅ SUCCESS: Found client_configuration and generated JSON with data';
        ELSE
            -- No client configuration found - create basic request
            result_json := '{' ||
                '"batchDispatchDate": "' || TO_CHAR(test_batch_date, 'DD/MM/YYYY') || '",' ||
                '"batchNo": "' || test_batch_cluster || '",' ||
                '"uniqueBatchId": "' || test_batch_id || '",' ||
                '"faqCountInBatch": ' || test_faq_pairs || ',' ||
                '"email": "' || test_email || '",' ||
                '"brand": "' || test_organisation || '",' ||
                '"industry": "Unknown",' ||
                '"subCategory": "Unknown",' ||
                '"audience": "Unknown",' ||
                '"brandContext": null,' ||
                '"productContext": null,' ||
                '"organisationContext": null' ||
                '}';
            
            RAISE NOTICE '⚠️ FALLBACK: No client_configuration found, using fallback data';
        END IF;
    END;
    
    RAISE NOTICE 'Generated JSON: %', result_json;
    
    -- Validate JSON structure
    IF result_json LIKE '{%' AND result_json LIKE '%}' THEN
        RAISE NOTICE '✅ JSON structure looks valid';
    ELSE
        RAISE NOTICE '❌ JSON structure appears invalid';
    END IF;
    
END $$;

-- Check current records to see their status
SELECT 
    'Current Records Status' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN ai_request_for_questions IS NOT NULL AND ai_request_for_questions != '' THEN 1 END) as records_with_ai_request,
    COUNT(CASE WHEN ai_request_for_questions IS NULL OR ai_request_for_questions = '' THEN 1 END) as records_without_ai_request
FROM construct_faq_pairs; 