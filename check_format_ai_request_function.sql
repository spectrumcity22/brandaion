-- Check the format_ai_request function
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'format_ai_request';

-- Check if there are any triggers that call this function
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE action_statement LIKE '%format_ai_request%';

-- Check what tables have product_jsonld_object column
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE column_name LIKE '%product_jsonld_object%'; 