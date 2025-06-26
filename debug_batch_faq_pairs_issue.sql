-- Debug why some batches still have null batch_faq_pairs and count mismatches

-- Check which batches still have null batch_faq_pairs
SELECT 
    'Batches with NULL batch_faq_pairs' as debug_type,
    unique_batch_id,
    COUNT(*) as question_count,
    COUNT(CASE WHEN batch_faq_pairs IS NULL THEN 1 END) as null_count,
    COUNT(CASE WHEN batch_faq_pairs IS NOT NULL THEN 1 END) as not_null_count
FROM review_questions 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
GROUP BY unique_batch_id
HAVING COUNT(CASE WHEN batch_faq_pairs IS NULL THEN 1 END) > 0
ORDER BY unique_batch_id;

-- Check if the source data exists for these batches
SELECT 
    'Source Data Check' as debug_type,
    rq.unique_batch_id,
    cfp.unique_batch_id as cfp_batch_id,
    cfp.total_faq_pairs as source_total_faq_pairs,
    COUNT(rq.id) as review_questions_count
FROM review_questions rq
LEFT JOIN construct_faq_pairs cfp ON rq.unique_batch_id = cfp.unique_batch_id
WHERE rq.auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND rq.batch_faq_pairs IS NULL
GROUP BY rq.unique_batch_id, cfp.unique_batch_id, cfp.total_faq_pairs
ORDER BY rq.unique_batch_id;

-- Check for count mismatches - why do we have different expected vs actual counts?
SELECT 
    'Count Mismatch Analysis' as debug_type,
    rq.unique_batch_id,
    rq.batch_faq_pairs as expected_count,
    COUNT(*) as total_questions,
    COUNT(CASE WHEN answer_status = 'approved' THEN 1 END) as approved_questions,
    COUNT(CASE WHEN answer_status = 'completed' THEN 1 END) as completed_questions,
    COUNT(CASE WHEN answer_status = 'pending' THEN 1 END) as pending_questions,
    COUNT(CASE WHEN answer_status IS NULL THEN 1 END) as null_status_questions
FROM review_questions rq
WHERE rq.auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND rq.batch_faq_pairs IS NOT NULL
GROUP BY rq.unique_batch_id, rq.batch_faq_pairs
HAVING COUNT(CASE WHEN answer_status = 'approved' THEN 1 END) != rq.batch_faq_pairs
ORDER BY rq.unique_batch_id;

-- Check what the edge function actually sees
SELECT 
    'Edge Function View' as debug_type,
    unique_batch_id,
    batch_faq_pairs as expected_count,
    COUNT(*) as approved_with_answers,
    CASE 
        WHEN batch_faq_pairs IS NULL THEN 'NULL expected_count - will fail'
        WHEN COUNT(*) = batch_faq_pairs THEN 'Count matches - will pass'
        ELSE 'Count mismatch - will fail'
    END as edge_function_outcome
FROM review_questions 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND answer_status = 'approved'
  AND ai_response_answers IS NOT NULL
GROUP BY unique_batch_id, batch_faq_pairs
ORDER BY unique_batch_id; 