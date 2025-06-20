-- Step 14: Check for JSON-LD fields in construct_faq_pairs

SELECT 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name = 'construct_faq_pairs'
  AND (column_name LIKE '%jsonld%' OR column_name LIKE '%brand%' OR column_name LIKE '%organisation%')
ORDER BY column_name; 