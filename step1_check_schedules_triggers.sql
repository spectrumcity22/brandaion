-- Step 1: Check what triggers exist on the schedules table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'schedules'
ORDER BY trigger_name; 