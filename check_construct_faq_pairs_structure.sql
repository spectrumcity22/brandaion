-- Check the structure of construct_faq_pairs table
SELECT 
    'Table Structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'construct_faq_pairs'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if there are any timestamp/date columns
SELECT 
    'Timestamp Columns' as check_type,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'construct_faq_pairs'
  AND table_schema = 'public'
  AND data_type LIKE '%timestamp%' OR data_type LIKE '%date%'
ORDER BY column_name;

-- Check sample data to see what's actually in the table
SELECT 
    'Sample Data' as check_type,
    id,
    unique_batch_id,
    unique_batch_cluster,
    batch_date,
    batch_faq_pairs,
    organisation,
    user_email,
    auth_user_id,
    question_status,
    ai_request_for_questions IS NOT NULL as has_ai_request,
    ai_response_questions IS NOT NULL as has_ai_response
FROM construct_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
LIMIT 3; 