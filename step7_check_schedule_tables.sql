-- Step 7: Check what schedule-related tables exist
SELECT 
    table_name
FROM information_schema.tables 
WHERE table_name LIKE '%schedule%'
ORDER BY table_name; 