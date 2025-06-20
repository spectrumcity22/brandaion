-- Step 4: Check what tables exist with similar names
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name LIKE '%question%' 
   OR table_name LIKE '%review%'
   OR table_name LIKE '%approved%'
ORDER BY table_name; 