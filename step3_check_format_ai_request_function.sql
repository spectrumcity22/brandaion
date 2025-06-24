-- Step 3: Check what the format_ai_request function does
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'format_ai_request'; 