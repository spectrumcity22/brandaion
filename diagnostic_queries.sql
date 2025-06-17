-- Check table structure
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'construct_faq_pairs';

-- Check constraints
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'construct_faq_pairs'::regclass;

-- Check current data
SELECT 
    id,
    generation_status,
    error_message,
    ai_response_questions,
    ai_request_for_questions,
    unique_batch_id,
    auth_user_id
FROM construct_faq_pairs
ORDER BY id DESC
LIMIT 10;

-- Count by status
SELECT 
    generation_status,
    COUNT(*) as count
FROM construct_faq_pairs
GROUP BY generation_status;

-- Check for any invalid status values
SELECT 
    id,
    generation_status
FROM construct_faq_pairs
WHERE generation_status NOT IN ('pending', 'generating_questions', 'generating_answers', 'completed', 'failed');

-- Examine pending records in detail
SELECT 
    id,
    generation_status,
    error_message,
    ai_response_questions,
    ai_request_for_questions,
    unique_batch_id,
    auth_user_id
FROM construct_faq_pairs
WHERE generation_status = 'pending'
ORDER BY id DESC; 