-- Step 14: Check what fields are available in construct_faq_pairs

SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'construct_faq_pairs'
ORDER BY ordinal_position; 