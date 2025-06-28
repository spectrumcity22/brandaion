-- Step 2: Check all triggers that reference construct_faq_pairs
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE action_statement LIKE '%construct_faq_pairs%'
ORDER BY trigger_name; 