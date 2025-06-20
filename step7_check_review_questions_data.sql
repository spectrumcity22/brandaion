-- Step 7: Check if the trigger is actually firing by looking at review_questions data

-- Check total count in review_questions
SELECT 
    COUNT(*) as review_questions_count
FROM review_questions;

-- Check if any questions were split from the construct_faq_pairs we saw
SELECT 
    unique_batch_id,
    COUNT(*) as question_count
FROM review_questions 
WHERE unique_batch_id IN (
    '607d61a3-227e-449a-9faa-10e8d097ae1c',
    '00f22db0-3629-44ee-a15f-2240bc5493db',
    '429d1ad1-6721-4148-b65c-4e899f6d9982',
    '3340c19b-10c1-4fac-a72b-e8ab61f37511'
)
GROUP BY unique_batch_id; 