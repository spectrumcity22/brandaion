-- Step 6 (Simplified): Check data in review_questions and trigger condition

-- Check data in review_questions  
SELECT 
    COUNT(*) as review_questions_count,
    COUNT(CASE WHEN question_status = 'questions_generated' THEN 1 END) as questions_generated_count
FROM review_questions;

-- Check the trigger condition - what happens when construct_faq_pairs.question_status changes
SELECT 
    id,
    unique_batch_id,
    question_status,
    ai_response_questions,
    generation_status
FROM construct_faq_pairs 
WHERE question_status = 'questions_generated'
ORDER BY created_at DESC
LIMIT 5; 