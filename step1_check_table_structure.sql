-- Step 1: Check the current review_questions table structure
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'review_questions'
ORDER BY ordinal_position; 