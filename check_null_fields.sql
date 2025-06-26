-- Check which fields have null values in approved questions
-- This will help us understand what data is missing and if it's needed

-- Check the current state of all fields for approved questions
SELECT 
    'Field Analysis' as check_type,
    COUNT(*) as total_approved_questions,
    COUNT(CASE WHEN unique_batch_id IS NOT NULL THEN 1 END) as has_unique_batch_id,
    COUNT(CASE WHEN batch_faq_pairs IS NOT NULL THEN 1 END) as has_batch_faq_pairs,
    COUNT(CASE WHEN organisation IS NOT NULL THEN 1 END) as has_organisation,
    COUNT(CASE WHEN market_name IS NOT NULL THEN 1 END) as has_market_name,
    COUNT(CASE WHEN audience_name IS NOT NULL THEN 1 END) as has_audience_name,
    COUNT(CASE WHEN persona_jsonld IS NOT NULL THEN 1 END) as has_persona_jsonld,
    COUNT(CASE WHEN product_jsonld_object IS NOT NULL THEN 1 END) as has_product_jsonld_object,
    COUNT(CASE WHEN question IS NOT NULL THEN 1 END) as has_question,
    COUNT(CASE WHEN topic IS NOT NULL THEN 1 END) as has_topic
FROM review_questions 
WHERE question_status = 'question_approved';

-- Show a sample record with all field values to see what's null
SELECT 
    'Sample Record Analysis' as check_type,
    id,
    unique_batch_id,
    batch_faq_pairs,
    organisation,
    market_name,
    audience_name,
    persona_jsonld IS NOT NULL as has_persona_jsonld,
    product_jsonld_object IS NOT NULL as has_product_jsonld_object,
    question,
    topic,
    ai_request_for_answers IS NOT NULL as has_ai_request_for_answers
FROM review_questions 
WHERE question_status = 'question_approved'
ORDER BY updated_at DESC
LIMIT 3;

-- Check what the generate_ai_request_for_answers function actually uses
-- Let's look at the function definition to see which parameters are required
SELECT 
    'Function Parameters' as check_type,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as parameters
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'generate_ai_request_for_answers';

-- Test the function with null values to see if it handles them gracefully
SELECT 
    'Function Test with Nulls' as check_type,
    id,
    question,
    public.generate_ai_request_for_answers(
        unique_batch_id,
        batch_faq_pairs,
        organisation,
        market_name,
        audience_name,
        persona_jsonld,
        product_jsonld_object,
        question,
        topic
    ) as generated_request
FROM review_questions 
WHERE question_status = 'question_approved'
  AND (batch_faq_pairs IS NULL OR persona_jsonld IS NULL OR product_jsonld_object IS NULL)
LIMIT 1; 