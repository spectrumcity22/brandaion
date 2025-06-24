-- Check triggers on schedule table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'schedule'
ORDER BY trigger_name;

-- Check if there are any functions that reference product_jsonld_object
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition LIKE '%product_jsonld_object%';

-- Check the schedule table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'schedule' 
ORDER BY ordinal_position; 