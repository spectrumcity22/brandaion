-- Test the trigger by updating an existing approved question
-- This will trigger the ai_request_for_answers population

-- First, show the current state of the test record
SELECT 
    'Before Update' as check_type,
    id,
    question_status,
    ai_request_for_answers IS NULL as missing_ai_request,
    answer_status
FROM review_questions 
WHERE id = 39;

-- Update the question to trigger the ai_request_for_answers generation
-- This simulates what happens when a question is approved
UPDATE review_questions 
SET question_status = 'question_approved'
WHERE id = 39
  AND question_status = 'question_approved'
  AND (ai_request_for_answers IS NULL OR ai_request_for_answers = '');

-- Show the result after the update
SELECT 
    'After Update' as check_type,
    id,
    question_status,
    ai_request_for_answers IS NOT NULL as has_ai_request,
    LEFT(ai_request_for_answers, 100) as ai_request_preview,
    answer_status
FROM review_questions 
WHERE id = 39;

-- Check if there are other approved questions that need the same fix
SELECT 
    'Other Questions Needing Fix' as check_type,
    COUNT(*) as count,
    'Approved questions missing ai_request_for_answers' as description
FROM review_questions 
WHERE question_status = 'question_approved'
  AND (ai_request_for_answers IS NULL OR ai_request_for_answers = '');

-- Show a few examples of other questions that need fixing
SELECT 
    'Sample Questions to Fix' as check_type,
    id,
    unique_batch_id,
    question,
    topic,
    organisation
FROM review_questions 
WHERE question_status = 'question_approved'
  AND (ai_request_for_answers IS NULL OR ai_request_for_answers = '')
ORDER BY created_at DESC
LIMIT 3; 