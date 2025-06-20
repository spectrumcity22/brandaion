-- Reset questions for testing the edge function
-- This will set some questions to 'approved' status so we can test the FAQ batch generation

-- 1. First, let's see what questions we have and their current status
SELECT 
    id,
    unique_batch_id,
    answer_status,
    ai_response_answers IS NOT NULL as has_answers,
    question,
    created_at
FROM review_questions 
ORDER BY created_at DESC
LIMIT 10;

-- 2. Find questions that have ai_response_answers but are not approved/completed
SELECT 
    unique_batch_id,
    COUNT(*) as total_questions,
    COUNT(CASE WHEN answer_status = 'approved' THEN 1 END) as approved_questions,
    COUNT(CASE WHEN answer_status = 'completed' THEN 1 END) as completed_questions,
    COUNT(CASE WHEN answer_status = 'pending' THEN 1 END) as pending_questions,
    COUNT(CASE WHEN ai_response_answers IS NOT NULL THEN 1 END) as questions_with_answers
FROM review_questions 
WHERE unique_batch_id IS NOT NULL
GROUP BY unique_batch_id
ORDER BY total_questions DESC;

-- 3. Reset questions to 'approved' status for testing
-- Choose a specific batch to test with (replace 'your-batch-id' with actual batch ID)
UPDATE review_questions 
SET answer_status = 'approved'
WHERE unique_batch_id = 'your-batch-id-here'  -- Replace with your actual batch ID
  AND ai_response_answers IS NOT NULL
  AND answer_status IN ('pending', 'generating', 'failed');

-- 4. Alternative: Reset the most recent questions that have answers
UPDATE review_questions 
SET answer_status = 'approved'
WHERE id IN (
    SELECT id 
    FROM review_questions 
    WHERE ai_response_answers IS NOT NULL
      AND answer_status IN ('pending', 'generating', 'failed')
    ORDER BY created_at DESC
    LIMIT 5  -- Reset 5 questions for testing
);

-- 5. Verify the reset worked
SELECT 
    id,
    unique_batch_id,
    answer_status,
    ai_response_answers IS NOT NULL as has_answers,
    question,
    created_at
FROM review_questions 
WHERE answer_status = 'approved'
ORDER BY created_at DESC
LIMIT 10;

-- 6. Check which batches now have approved questions ready for testing
SELECT 
    unique_batch_id,
    COUNT(*) as total_questions,
    COUNT(CASE WHEN answer_status = 'approved' THEN 1 END) as approved_questions,
    COUNT(CASE WHEN answer_status = 'completed' THEN 1 END) as completed_questions
FROM review_questions 
WHERE answer_status IN ('approved', 'completed')
  AND ai_response_answers IS NOT NULL
GROUP BY unique_batch_id
HAVING COUNT(CASE WHEN answer_status IN ('approved', 'completed') THEN 1 END) > 0
ORDER BY approved_questions DESC; 