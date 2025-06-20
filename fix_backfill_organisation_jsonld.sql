-- Fix the backfill - update review_questions with correct organisation_jsonld_object data

UPDATE review_questions 
SET organisation_jsonld_object = cfp.organisation_jsonld_object
FROM construct_faq_pairs cfp
WHERE review_questions.unique_batch_id = cfp.unique_batch_id
  AND cfp.organisation_jsonld_object IS NOT NULL;

-- Check the results
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN organisation_jsonld_object IS NOT NULL THEN 1 END) as records_with_organisation_jsonld,
    COUNT(CASE WHEN organisation_jsonld_object IS NULL THEN 1 END) as records_without_organisation_jsonld
FROM review_questions;

-- Show a sample of the fixed data
SELECT 
    id,
    organisation_jsonld_object
FROM review_questions 
WHERE organisation_jsonld_object IS NOT NULL
ORDER BY created_at DESC
LIMIT 3; 