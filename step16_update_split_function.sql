-- Step 16: Update the split function to include organisation_jsonld_object

-- First, let's check what the field is called in construct_faq_pairs
SELECT 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name = 'construct_faq_pairs'
  AND (column_name LIKE '%organisation%' OR column_name LIKE '%brand%' OR column_name LIKE '%jsonld%')
ORDER BY column_name; 