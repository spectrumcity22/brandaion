-- Check all triggers on the schedules table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'schedules'
ORDER BY trigger_name;

-- Check if there are any triggers that reference construct_faq_pairs
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE action_statement LIKE '%construct_faq_pairs%'
ORDER BY trigger_name;

-- Check if there are any functions that insert into construct_faq_pairs
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition LIKE '%construct_faq_pairs%'
ORDER BY routine_name;

-- Check the construct_faq_pairs table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'construct_faq_pairs' 
ORDER BY ordinal_position; 