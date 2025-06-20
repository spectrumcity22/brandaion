-- Check why the frontend isn't showing questions to approve
-- The issue is likely that questions don't have ai_response_answers populated

-- 1. Check the current state of questions
SELECT 
    id,
    unique_batch_id,
    answer_status,
    ai_response_answers IS NOT NULL as has_answers,
    ai_response_answers,
    question,
    created_at
FROM review_questions 
WHERE unique_batch_id IN (
    '00f22db0-3629-44ee-a15f-2240bc5493db',
    '607d61a3-227e-449a-9faa-10e8d097ae1c'
)
ORDER BY unique_batch_id, id;

-- 2. Check what the frontend is probably looking for
-- Most likely it's looking for questions with ai_response_answers but pending status
SELECT 
    id,
    unique_batch_id,
    answer_status,
    ai_response_answers IS NOT NULL as has_answers,
    question
FROM review_questions 
WHERE answer_status = 'pending'
  AND ai_response_answers IS NOT NULL
ORDER BY created_at DESC;

-- 3. Count questions by status and answer availability
SELECT 
    unique_batch_id,
    answer_status,
    ai_response_answers IS NOT NULL as has_answers,
    COUNT(*) as count
FROM review_questions 
GROUP BY unique_batch_id, answer_status, ai_response_answers IS NOT NULL
ORDER BY unique_batch_id, answer_status, has_answers;

-- 4. If questions don't have answers, we need to populate them for testing
-- This will add some dummy answers for testing purposes
UPDATE review_questions 
SET ai_response_answers = 'This is a test answer for approval testing. The FAQ Pairs solution provides comprehensive customer support through AI-powered question answering.'
WHERE unique_batch_id IN (
    '00f22db0-3629-44ee-a15f-2240bc5493db',
    '607d61a3-227e-449a-9faa-10e8d097ae1c'
)
AND answer_status = 'pending'
AND ai_response_answers IS NULL;

-- 5. Verify the update worked
SELECT 
    id,
    unique_batch_id,
    answer_status,
    ai_response_answers IS NOT NULL as has_answers,
    LEFT(ai_response_answers, 50) as answer_preview
FROM review_questions 
WHERE unique_batch_id IN (
    '00f22db0-3629-44ee-a15f-2240bc5493db',
    '607d61a3-227e-449a-9faa-10e8d097ae1c'
)
ORDER BY unique_batch_id, id; 