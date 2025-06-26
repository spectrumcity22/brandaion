-- Check for questions that have answers but might be showing incorrect status
-- This will help identify if there are display issues

-- Check all questions and their current status
SELECT 
    'Question Status Analysis' as check_type,
    id,
    question_status,
    answer_status,
    CASE 
        WHEN ai_response_answers IS NOT NULL AND ai_response_answers != '' THEN 'Has Answer'
        ELSE 'No Answer'
    END as answer_presence,
    CASE 
        WHEN question_status = 'question_approved' AND (ai_response_answers IS NULL OR ai_response_answers = '') THEN 'Approved but No Answer'
        WHEN question_status = 'question_approved' AND ai_response_answers IS NOT NULL AND ai_response_answers != '' THEN 'Approved with Answer'
        ELSE 'Not Approved'
    END as approval_status,
    LEFT(question, 50) as question_preview
FROM review_questions 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'  -- Replace with your user ID
ORDER BY id DESC;

-- Check specifically for questions that are approved but missing answers
SELECT 
    'Approved Questions Missing Answers' as check_type,
    COUNT(*) as count,
    'These questions are approved but have no ai_response_answers' as description
FROM review_questions 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'  -- Replace with your user ID
  AND question_status = 'question_approved'
  AND (ai_response_answers IS NULL OR ai_response_answers = '');

-- Check for questions that have answers but wrong status
SELECT 
    'Questions with Answers but Wrong Status' as check_type,
    COUNT(*) as count,
    'These questions have answers but answer_status is not completed' as description
FROM review_questions 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'  -- Replace with your user ID
  AND ai_response_answers IS NOT NULL 
  AND ai_response_answers != ''
  AND answer_status != 'completed'; 