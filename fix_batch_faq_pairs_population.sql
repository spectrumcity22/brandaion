-- Safe, non-destructive update to populate batch_faq_pairs in review_questions
-- This gets the data from construct_faq_pairs table

-- First, let's see what we're working with
SELECT 
    'Current State Analysis' as check_type,
    COUNT(*) as total_review_questions,
    COUNT(CASE WHEN batch_faq_pairs IS NOT NULL THEN 1 END) as has_batch_faq_pairs,
    COUNT(CASE WHEN batch_faq_pairs IS NULL THEN 1 END) as missing_batch_faq_pairs
FROM review_questions 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- Show sample of missing batch_faq_pairs
SELECT 
    'Sample Missing batch_faq_pairs' as check_type,
    rq.id,
    rq.unique_batch_id,
    rq.batch_faq_pairs as current_batch_faq_pairs,
    cfp.total_faq_pairs as construct_faq_pairs_total
FROM review_questions rq
LEFT JOIN construct_faq_pairs cfp ON rq.unique_batch_id = cfp.unique_batch_id
WHERE rq.auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND rq.batch_faq_pairs IS NULL
LIMIT 5;

-- Update batch_faq_pairs safely - only update NULL values
UPDATE review_questions 
SET batch_faq_pairs = cfp.total_faq_pairs
FROM construct_faq_pairs cfp
WHERE review_questions.unique_batch_id = cfp.unique_batch_id
  AND review_questions.auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND review_questions.batch_faq_pairs IS NULL
  AND cfp.total_faq_pairs IS NOT NULL;

-- Verify the update worked
SELECT 
    'After Update Verification' as check_type,
    COUNT(*) as total_review_questions,
    COUNT(CASE WHEN batch_faq_pairs IS NOT NULL THEN 1 END) as has_batch_faq_pairs,
    COUNT(CASE WHEN batch_faq_pairs IS NULL THEN 1 END) as still_missing_batch_faq_pairs
FROM review_questions 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- Show sample of updated records
SELECT 
    'Sample Updated Records' as check_type,
    id,
    unique_batch_id,
    batch_faq_pairs,
    question_status,
    answer_status
FROM review_questions 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND batch_faq_pairs IS NOT NULL
ORDER BY id DESC
LIMIT 5; 