-- Step 5: Check the structure of review_questions table
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'review_questions'
ORDER BY ordinal_position; 