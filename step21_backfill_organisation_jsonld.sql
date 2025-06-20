-- Step 21: Backfill organisation_jsonld_object in review_questions

-- Update review_questions to set organisation_jsonld_object from construct_faq_pairs
UPDATE review_questions 
SET organisation_jsonld_object = cfp.brand_jsonld_object
FROM construct_faq_pairs cfp
WHERE review_questions.unique_batch_id = cfp.unique_batch_id
  AND review_questions.organisation_jsonld_object IS NULL
  AND cfp.brand_jsonld_object IS NOT NULL;

-- Check how many records were updated
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN organisation_jsonld_object IS NOT NULL THEN 1 END) as records_with_organisation_jsonld,
    COUNT(CASE WHEN organisation_jsonld_object IS NULL THEN 1 END) as records_without_organisation_jsonld
FROM review_questions; 