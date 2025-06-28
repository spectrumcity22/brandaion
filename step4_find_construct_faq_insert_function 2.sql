-- Step 4: Find functions that INSERT into construct_faq_pairs
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition LIKE '%INSERT INTO construct_faq_pairs%'
ORDER BY routine_name; 