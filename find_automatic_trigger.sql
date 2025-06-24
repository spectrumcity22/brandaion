-- Find the automatic trigger that creates construct_faq_pairs
-- This will help us identify what needs to be disabled

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

-- Check all functions that reference construct_faq_pairs
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition LIKE '%construct_faq_pairs%'
ORDER BY routine_name;

-- Check if there are any triggers that call functions with construct_faq_pairs
SELECT 
    t.trigger_name,
    t.event_object_table,
    t.action_statement,
    r.routine_name
FROM information_schema.triggers t
JOIN information_schema.routines r ON t.action_statement LIKE '%' || r.routine_name || '%'
WHERE r.routine_definition LIKE '%construct_faq_pairs%'
ORDER BY t.trigger_name; 