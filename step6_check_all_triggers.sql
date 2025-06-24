-- Step 6: Check all triggers in the database
SELECT 
    trigger_name,
    event_object_table,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
ORDER BY event_object_table, trigger_name; 