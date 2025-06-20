-- Debug: Check why the edge function isn't finding completed questions

-- 1. Check all questions for a specific batch (replace with your actual batch_id)
-- Replace 'your-batch-id-here' with the actual unique_batch_id you're testing
SELECT 
    id,
    unique_batch_id,
    answer_status,
    ai_response_answers,
    auth_user_id,
    question,
    topic,
    created_at
FROM review_questions 
WHERE unique_batch_id = 'your-batch-id-here'  -- Replace this with your actual batch ID
ORDER BY created_at DESC;

-- 2. Check all questions with 'completed' status
SELECT 
    unique_batch_id,
    COUNT(*) as total_questions,
    COUNT(CASE WHEN answer_status = 'completed' THEN 1 END) as completed_questions,
    COUNT(CASE WHEN answer_status = 'pending' THEN 1 END) as pending_questions,
    COUNT(CASE WHEN answer_status = 'generating' THEN 1 END) as generating_questions,
    COUNT(CASE WHEN answer_status = 'failed' THEN 1 END) as failed_questions
FROM review_questions 
GROUP BY unique_batch_id
HAVING COUNT(CASE WHEN answer_status = 'completed' THEN 1 END) > 0
ORDER BY completed_questions DESC;

-- 3. Check questions that have ai_response_answers but wrong status
SELECT 
    unique_batch_id,
    answer_status,
    ai_response_answers IS NOT NULL as has_answers,
    COUNT(*) as count
FROM review_questions 
WHERE ai_response_answers IS NOT NULL
  AND answer_status != 'completed'
GROUP BY unique_batch_id, answer_status, ai_response_answers IS NOT NULL
ORDER BY count DESC;

-- 4. Find batches that might be ready for processing
SELECT 
    unique_batch_id,
    batch_faq_pairs,
    COUNT(*) as total_questions,
    COUNT(CASE WHEN answer_status = 'completed' THEN 1 END) as completed_questions,
    COUNT(CASE WHEN ai_response_answers IS NOT NULL THEN 1 END) as questions_with_answers
FROM review_questions 
WHERE unique_batch_id IS NOT NULL
GROUP BY unique_batch_id, batch_faq_pairs
HAVING COUNT(CASE WHEN answer_status = 'completed' THEN 1 END) > 0
ORDER BY completed_questions DESC;

-- 5. Check the most recent questions to see their status
SELECT 
    id,
    unique_batch_id,
    answer_status,
    ai_response_answers IS NOT NULL as has_answers,
    created_at
FROM review_questions 
ORDER BY created_at DESC
LIMIT 10; 