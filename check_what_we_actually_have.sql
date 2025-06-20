-- Check what we actually have in construct_faq_pairs
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'construct_faq_pairs'
ORDER BY ordinal_position;

-- Check what we actually have in review_questions
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'review_questions'
ORDER BY ordinal_position;

-- Check what data is actually in brand_jsonld_object vs organisation_jsonld_object
SELECT 
    id,
    brand_jsonld_object,
    organisation_jsonld_object
FROM construct_faq_pairs 
LIMIT 3;

-- Check what data is actually in review_questions organisation_jsonld_object
SELECT 
    id,
    organisation_jsonld_object
FROM review_questions 
WHERE organisation_jsonld_object IS NOT NULL
LIMIT 3; 