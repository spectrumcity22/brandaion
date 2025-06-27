-- Test to see what format the AI data is actually being saved
-- This will help us understand why the SQL function isn't finding the AI fields

SELECT 
    id,
    brand_name,
    ai_response,
    brand_jsonld_object
FROM brands 
WHERE ai_response IS NOT NULL 
LIMIT 5; 