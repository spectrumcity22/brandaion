-- Reset questions to a testing state
-- This will set questions back to 'pending' status so we can test the full approval -> batch generation flow

-- 1. First, let's see what we're working with
SELECT 
    unique_batch_id,
    COUNT(*) as total_questions,
    COUNT(CASE WHEN answer_status = 'approved' THEN 1 END) as approved_questions,
    COUNT(CASE WHEN answer_status = 'pending' THEN 1 END) as pending_questions,
    COUNT(CASE WHEN ai_response_answers IS NOT NULL THEN 1 END) as questions_with_answers
FROM review_questions 
WHERE unique_batch_id IN (
    '00f22db0-3629-44ee-a15f-2240bc5493db',
    '607d61a3-227e-449a-9faa-10e8d097ae1c'
)
GROUP BY unique_batch_id;

-- 2. Reset approved questions back to pending (so we can test the approval process)
UPDATE review_questions 
SET answer_status = 'pending'
WHERE unique_batch_id IN (
    '00f22db0-3629-44ee-a15f-2240bc5493db',
    '607d61a3-227e-449a-9faa-10e8d097ae1c'
)
AND answer_status = 'approved'
AND ai_response_answers IS NOT NULL;

-- 3. Verify the reset worked
SELECT 
    unique_batch_id,
    COUNT(*) as total_questions,
    COUNT(CASE WHEN answer_status = 'approved' THEN 1 END) as approved_questions,
    COUNT(CASE WHEN answer_status = 'pending' THEN 1 END) as pending_questions,
    COUNT(CASE WHEN ai_response_answers IS NOT NULL THEN 1 END) as questions_with_answers
FROM review_questions 
WHERE unique_batch_id IN (
    '00f22db0-3629-44ee-a15f-2240bc5493db',
    '607d61a3-227e-449a-9faa-10e8d097ae1c'
)
GROUP BY unique_batch_id;

-- 4. Show the current state of questions
SELECT 
    id,
    unique_batch_id,
    answer_status,
    ai_response_answers IS NOT NULL as has_answers,
    question,
    created_at
FROM review_questions 
WHERE unique_batch_id IN (
    '00f22db0-3629-44ee-a15f-2240bc5493db',
    '607d61a3-227e-449a-9faa-10e8d097ae1c'
)
ORDER BY unique_batch_id, id;

-- 5. Now you can test the full flow:
-- Step 1: Approve some questions (set answer_status = 'approved')
-- Step 2: Test the batch generation edge function
-- Step 3: Verify the batch_faq_pairs table gets populated

-- Optional: Reset a few questions to approved for immediate testing
UPDATE review_questions 
SET answer_status = 'approved'
WHERE id IN (
    SELECT id 
    FROM review_questions 
    WHERE unique_batch_id = '00f22db0-3629-44ee-a15f-2240bc5493db'
      AND ai_response_answers IS NOT NULL
      AND answer_status = 'pending'
    ORDER BY id
    LIMIT 3  -- Approve 3 questions for testing
); 