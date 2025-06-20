-- Check batch completion for testing
-- This will show if the batches have the expected number of questions

SELECT 
    unique_batch_id,
    batch_faq_pairs as expected_count,
    COUNT(*) as total_questions,
    COUNT(CASE WHEN answer_status = 'approved' THEN 1 END) as approved_questions,
    COUNT(CASE WHEN answer_status = 'completed' THEN 1 END) as completed_questions,
    COUNT(CASE WHEN ai_response_answers IS NOT NULL THEN 1 END) as questions_with_answers,
    CASE 
        WHEN COUNT(CASE WHEN answer_status IN ('approved', 'completed') THEN 1 END) = batch_faq_pairs 
        THEN '✅ Ready for testing'
        ELSE '❌ Incomplete batch'
    END as status
FROM review_questions 
WHERE unique_batch_id IN (
    '00f22db0-3629-44ee-a15f-2240bc5493db',
    '607d61a3-227e-449a-9faa-10e8d097ae1c'
)
GROUP BY unique_batch_id, batch_faq_pairs;

-- Check individual questions in the first batch
SELECT 
    id,
    unique_batch_id,
    answer_status,
    ai_response_answers IS NOT NULL as has_answers,
    batch_faq_pairs,
    question
FROM review_questions 
WHERE unique_batch_id = '00f22db0-3629-44ee-a15f-2240bc5493db'
ORDER BY id; 