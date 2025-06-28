-- Update existing records that don't have ai_request_for_questions populated
-- This will manually trigger the format_ai_request function for existing records

-- First, let's see how many records need updating
SELECT 
    'Records to Update' as check_type,
    COUNT(*) as count
FROM construct_faq_pairs 
WHERE ai_request_for_questions IS NULL OR ai_request_for_questions = '';

-- Update records that don't have ai_request_for_questions
-- We'll do this by temporarily disabling the trigger, updating the records, then re-enabling
DO $$
DECLARE
    record_count INTEGER;
    updated_count INTEGER := 0;
    record_record RECORD;
BEGIN
    -- Get count of records to update
    SELECT COUNT(*) INTO record_count
    FROM construct_faq_pairs 
    WHERE ai_request_for_questions IS NULL OR ai_request_for_questions = '';
    
    RAISE NOTICE 'Found % records to update', record_count;
    
    -- Loop through records and update them
    FOR record_record IN 
        SELECT id, auth_user_id, organisation, batch_date, unique_batch_cluster, 
               unique_batch_id, batch_faq_pairs, user_email
        FROM construct_faq_pairs 
        WHERE ai_request_for_questions IS NULL OR ai_request_for_questions = ''
    LOOP
        -- Update the record with the formatted AI request
        UPDATE construct_faq_pairs 
        SET ai_request_for_questions = (
            SELECT json_string
            FROM (
                SELECT '{' ||
                    '"batchDispatchDate": "' || TO_CHAR(record_record.batch_date, 'DD/MM/YYYY') || '",' ||
                    '"batchNo": "' || record_record.unique_batch_cluster || '",' ||
                    '"uniqueBatchId": "' || record_record.unique_batch_id || '",' ||
                    '"faqCountInBatch": ' || record_record.batch_faq_pairs || ',' ||
                    '"email": "' || record_record.user_email || '",' ||
                    '"brand": "' || record_record.organisation || '",' ||
                    '"industry": "' || COALESCE(cc.market_name, 'Unknown') || '",' ||
                    '"subCategory": "' || COALESCE(cc.product_name, 'Unknown') || '",' ||
                    '"audience": "' || COALESCE(cc.audience_name, 'Unknown') || '",' ||
                    '"brandContext": ' || COALESCE(cc.brand_jsonld_object::text, 'null') || ',' ||
                    '"productContext": ' || COALESCE(cc.schema_json::text, 'null') || ',' ||
                    '"organisationContext": ' || COALESCE(cc.organisation_jsonld_object::text, 'null') ||
                    '}' as json_string
                FROM client_configuration cc
                WHERE cc.auth_user_id = record_record.auth_user_id
                LIMIT 1
            ) subquery
        )
        WHERE id = record_record.id;
        
        updated_count := updated_count + 1;
        
        -- Log progress every 10 records
        IF updated_count % 10 = 0 THEN
            RAISE NOTICE 'Updated % records so far', updated_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Successfully updated % records', updated_count;
END $$;

-- Verify the updates worked
SELECT 
    'Update Verification' as check_type,
    COUNT(*) as remaining_null_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ All records now have ai_request_for_questions'
        ELSE '❌ Still have ' || COUNT(*) || ' records without ai_request_for_questions'
    END as status
FROM construct_faq_pairs 
WHERE ai_request_for_questions IS NULL OR ai_request_for_questions = '';

-- Show a sample of updated records
SELECT 
    'Sample Updated Record' as check_type,
    id,
    organisation,
    LEFT(ai_request_for_questions, 200) as ai_request_preview
FROM construct_faq_pairs 
WHERE ai_request_for_questions IS NOT NULL 
  AND ai_request_for_questions != ''
LIMIT 3; 