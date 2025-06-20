-- Step 16: Check if the JSON-LD fields are actually populated in review_questions

SELECT 
    COUNT(*) as total_rows,
    COUNT(CASE WHEN brand_jsonld_object IS NOT NULL THEN 1 END) as rows_with_brand_jsonld,
    COUNT(CASE WHEN product_jsonld_object IS NOT NULL THEN 1 END) as rows_with_product_jsonld,
    COUNT(CASE WHEN persona_jsonld IS NOT NULL THEN 1 END) as rows_with_persona_jsonld,
    COUNT(CASE WHEN organisation_jsonld_object IS NOT NULL THEN 1 END) as rows_with_organisation_jsonld
FROM review_questions; 