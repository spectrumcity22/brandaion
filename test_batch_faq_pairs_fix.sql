-- Comprehensive test to verify batch_faq_pairs fix is working

-- Test 1: Check if batch_faq_pairs is now populated
SELECT 
    'Test 1: batch_faq_pairs Population' as test_name,
    COUNT(*) as total_questions,
    COUNT(CASE WHEN batch_faq_pairs IS NOT NULL THEN 1 END) as has_batch_faq_pairs,
    COUNT(CASE WHEN batch_faq_pairs IS NULL THEN 1 END) as still_null,
    CASE 
        WHEN COUNT(CASE WHEN batch_faq_pairs IS NULL THEN 1 END) = 0 THEN '✅ PASS - All questions have batch_faq_pairs'
        ELSE '❌ FAIL - Some questions still missing batch_faq_pairs'
    END as test_result
FROM review_questions 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- Test 2: Check if the values match the source data
SELECT 
    'Test 2: Data Consistency' as test_name,
    rq.unique_batch_id,
    rq.batch_faq_pairs as review_questions_value,
    cfp.total_faq_pairs as construct_faq_pairs_value,
    CASE 
        WHEN rq.batch_faq_pairs = cfp.total_faq_pairs THEN '✅ PASS - Values match'
        ELSE '❌ FAIL - Values do not match'
    END as test_result
FROM review_questions rq
JOIN construct_faq_pairs cfp ON rq.unique_batch_id = cfp.unique_batch_id
WHERE rq.auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND rq.batch_faq_pairs IS NOT NULL
LIMIT 5;

-- Test 3: Check if batch processing validation would pass
SELECT 
    'Test 3: Batch Processing Validation' as test_name,
    unique_batch_id,
    batch_faq_pairs as expected_count,
    COUNT(*) as actual_approved_questions,
    CASE 
        WHEN batch_faq_pairs IS NOT NULL AND COUNT(*) = batch_faq_pairs THEN '✅ PASS - Ready for processing'
        WHEN batch_faq_pairs IS NULL THEN '❌ FAIL - batch_faq_pairs is NULL'
        WHEN COUNT(*) != batch_faq_pairs THEN '⚠️ WARNING - Count mismatch'
        ELSE '❌ FAIL - Unknown issue'
    END as test_result
FROM review_questions 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND answer_status = 'approved'
GROUP BY unique_batch_id, batch_faq_pairs
ORDER BY unique_batch_id;

-- Test 4: Check if function is updated correctly
SELECT 
    'Test 4: Function Update' as test_name,
    p.proname as function_name,
    CASE 
        WHEN p.prosrc LIKE '%batch_faq_pairs%' THEN '✅ PASS - Function includes batch_faq_pairs'
        ELSE '❌ FAIL - Function missing batch_faq_pairs'
    END as test_result
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'split_questions_into_review';

-- Test 5: Simulate what the edge function would see
SELECT 
    'Test 5: Edge Function Simulation' as test_name,
    unique_batch_id,
    batch_faq_pairs as expected_count,
    COUNT(*) as approved_questions_found,
    CASE 
        WHEN batch_faq_pairs IS NOT NULL AND COUNT(*) = batch_faq_pairs THEN '✅ Would PASS validation'
        ELSE '❌ Would FAIL validation'
    END as edge_function_result
FROM review_questions 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND answer_status = 'approved'
  AND ai_response_answers IS NOT NULL
GROUP BY unique_batch_id, batch_faq_pairs
ORDER BY unique_batch_id; 