-- Reset to schedule state by deleting all data after schedule creation
-- This will clean up all the problematic review_questions data

-- First, let's see what we're about to delete
SELECT 
    'Data to be Deleted' as check_type,
    'review_questions' as table_name,
    COUNT(*) as record_count
FROM review_questions 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

SELECT 
    'Data to be Deleted' as check_type,
    'batch_faq_pairs' as table_name,
    COUNT(*) as record_count
FROM batch_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- Show the schedule data that will remain
SELECT 
    'Data that will remain' as check_type,
    'construct_faq_pairs' as table_name,
    COUNT(*) as record_count
FROM construct_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- Delete all review_questions for this user
DELETE FROM review_questions 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- Delete all batch_faq_pairs for this user
DELETE FROM batch_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- Verify the cleanup
SELECT 
    'After Cleanup' as check_type,
    'review_questions' as table_name,
    COUNT(*) as remaining_count
FROM review_questions 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

SELECT 
    'After Cleanup' as check_type,
    'batch_faq_pairs' as table_name,
    COUNT(*) as remaining_count
FROM batch_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- Show the schedule data that remains
SELECT 
    'Schedule Data Remaining' as check_type,
    unique_batch_id,
    organisation,
    total_faq_pairs,
    question_status,
    created_at
FROM construct_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
ORDER BY created_at DESC; 