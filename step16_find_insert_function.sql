-- Step 16: Find the function that's doing this INSERT (without organisation_jsonld_object)

-- Look for functions that insert into review_questions with persona_jsonld and product_jsonld_object
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    p.prosrc as function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosrc ILIKE '%persona_jsonld%'
  AND p.prosrc ILIKE '%product_jsonld_object%'
  AND p.prosrc ILIKE '%review_questions%'
ORDER BY p.proname; 