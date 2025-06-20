-- Step 19: Check recent records to see if new ones are missing the JSON-LD fields

-- Check the most recent records to see if they have the JSON-LD fields populated
SELECT 
    id,
    unique_batch_id,
    question_status,
    persona_jsonld IS NOT NULL as has_persona_jsonld,
    product_jsonld_object IS NOT NULL as has_product_jsonld,
    organisation_jsonld_object IS NOT NULL as has_organisation_jsonld,
    created_at
FROM review_questions 
ORDER BY created_at DESC
LIMIT 10; 