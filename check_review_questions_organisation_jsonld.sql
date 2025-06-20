-- Check what's actually in review_questions organisation_jsonld_object
SELECT 
    id,
    organisation_jsonld_object,
    unique_batch_id
FROM review_questions 
ORDER BY created_at DESC
LIMIT 10; 