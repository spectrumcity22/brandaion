-- Disable automatic trigger that creates construct_faq_pairs when schedules are created
-- This should only happen when manually confirming the schedule

-- First, let's see what triggers exist on the schedules table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'schedules'
ORDER BY trigger_name;

-- Disable any triggers that might be creating construct_faq_pairs automatically
-- (We'll need to identify the specific trigger name from the above query)

-- Example: If there's a trigger called 'auto_create_construct_faq_pairs'
-- DROP TRIGGER IF EXISTS auto_create_construct_faq_pairs ON schedules;

-- Or disable it temporarily:
-- ALTER TABLE schedules DISABLE TRIGGER auto_create_construct_faq_pairs;

-- Check if there are any functions that are called by these triggers
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition LIKE '%construct_faq_pairs%'
AND routine_definition LIKE '%INSERT%'
ORDER BY routine_name; 