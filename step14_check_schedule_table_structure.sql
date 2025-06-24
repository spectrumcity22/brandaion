-- Step 14: Check the actual structure of the schedule table
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'schedule' 
ORDER BY ordinal_position; 