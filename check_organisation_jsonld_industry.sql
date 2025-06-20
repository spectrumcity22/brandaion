-- Check organisation_jsonld_object structure to understand industry field location
-- This will help us extract the correct industry value

-- 1. Check what fields are available in organisation_jsonld_object
SELECT 
    id,
    unique_batch_id,
    organisation_jsonld_object,
    CASE 
        WHEN organisation_jsonld_object IS NOT NULL THEN 
            jsonb_object_keys(organisation_jsonld_object)
        ELSE NULL
    END as available_fields
FROM review_questions 
WHERE organisation_jsonld_object IS NOT NULL
LIMIT 5;

-- 2. Check for industry-related fields in organisation_jsonld_object
SELECT 
    id,
    unique_batch_id,
    organisation_jsonld_object->>'industry' as industry,
    organisation_jsonld_object->>'sector' as sector,
    organisation_jsonld_object->>'businessType' as businessType,
    organisation_jsonld_object->>'@industry' as at_industry,
    organisation_jsonld_object->>'@sector' as at_sector,
    organisation_jsonld_object->>'@businessType' as at_businessType
FROM review_questions 
WHERE organisation_jsonld_object IS NOT NULL
LIMIT 10;

-- 3. Count how many records have industry-related fields
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN organisation_jsonld_object->>'industry' IS NOT NULL THEN 1 END) as has_industry,
    COUNT(CASE WHEN organisation_jsonld_object->>'sector' IS NOT NULL THEN 1 END) as has_sector,
    COUNT(CASE WHEN organisation_jsonld_object->>'businessType' IS NOT NULL THEN 1 END) as has_businessType,
    COUNT(CASE WHEN organisation_jsonld_object->>'@industry' IS NOT NULL THEN 1 END) as has_at_industry,
    COUNT(CASE WHEN organisation_jsonld_object->>'@sector' IS NOT NULL THEN 1 END) as has_at_sector,
    COUNT(CASE WHEN organisation_jsonld_object->>'@businessType' IS NOT NULL THEN 1 END) as has_at_businessType
FROM review_questions 
WHERE organisation_jsonld_object IS NOT NULL;

-- 4. Sample the actual organisation_jsonld_object content
SELECT 
    id,
    unique_batch_id,
    organisation_jsonld_object
FROM review_questions 
WHERE organisation_jsonld_object IS NOT NULL
  AND (organisation_jsonld_object ? 'industry' 
       OR organisation_jsonld_object ? 'sector' 
       OR organisation_jsonld_object ? 'businessType')
LIMIT 3; 