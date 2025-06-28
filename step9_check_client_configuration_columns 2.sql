-- Step 9: Check what columns exist in client_configuration table
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'client_configuration' 
ORDER BY ordinal_position; 