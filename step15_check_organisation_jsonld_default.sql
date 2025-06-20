-- Step 15: Check if organisation_jsonld_object has a default value or is being set elsewhere

-- Check the column definition for organisation_jsonld_object
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'review_questions'
  AND column_name = 'organisation_jsonld_object';

-- Check if there are any rows in review_questions with organisation_jsonld_object populated
SELECT 
    COUNT(*) as total_rows,
    COUNT(CASE WHEN organisation_jsonld_object IS NOT NULL THEN 1 END) as rows_with_organisation_jsonld,
    COUNT(CASE WHEN organisation_jsonld_object IS NULL THEN 1 END) as rows_without_organisation_jsonld
FROM review_questions; 