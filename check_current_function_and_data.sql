-- Check the current split_questions_into_review function definition
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'split_questions_into_review';

-- Check what's in brand_jsonld_object vs organisation_jsonld_object
SELECT 
    id,
    brand_jsonld_object,
    organisation_jsonld_object
FROM construct_faq_pairs 
WHERE brand_jsonld_object IS NOT NULL 
   OR organisation_jsonld_object IS NOT NULL
LIMIT 5; 