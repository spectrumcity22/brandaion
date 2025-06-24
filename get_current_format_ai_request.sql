-- Get the current format_ai_request function
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'format_ai_request'; 