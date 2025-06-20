-- Check if review_questions table has all the fields our edge function needs

-- 1. Check all columns in review_questions table
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'review_questions'
ORDER BY ordinal_position;

-- 2. Check specific fields our edge function uses
SELECT 
    CASE WHEN column_name = 'unique_batch_id' THEN '✅' ELSE '❌' END as unique_batch_id,
    CASE WHEN column_name = 'auth_user_id' THEN '✅' ELSE '❌' END as auth_user_id,
    CASE WHEN column_name = 'answer_status' THEN '✅' ELSE '❌' END as answer_status,
    CASE WHEN column_name = 'ai_response_answers' THEN '✅' ELSE '❌' END as ai_response_answers,
    CASE WHEN column_name = 'batch_faq_pairs' THEN '✅' ELSE '❌' END as batch_faq_pairs,
    CASE WHEN column_name = 'unique_batch_cluster' THEN '✅' ELSE '❌' END as unique_batch_cluster,
    CASE WHEN column_name = 'batch_date' THEN '✅' ELSE '❌' END as batch_date,
    CASE WHEN column_name = 'organisation' THEN '✅' ELSE '❌' END as organisation,
    CASE WHEN column_name = 'market_name' THEN '✅' ELSE '❌' END as market_name,
    CASE WHEN column_name = 'audience_name' THEN '✅' ELSE '❌' END as audience_name,
    CASE WHEN column_name = 'persona_name' THEN '✅' ELSE '❌' END as persona_name,
    CASE WHEN column_name = 'product_name' THEN '✅' ELSE '❌' END as product_name,
    CASE WHEN column_name = 'organisation_jsonld_object' THEN '✅' ELSE '❌' END as organisation_jsonld_object,
    CASE WHEN column_name = 'product_jsonld_object' THEN '✅' ELSE '❌' END as product_jsonld_object,
    CASE WHEN column_name = 'persona_jsonld' THEN '✅' ELSE '❌' END as persona_jsonld,
    CASE WHEN column_name = 'topic' THEN '✅' ELSE '❌' END as topic,
    CASE WHEN column_name = 'question' THEN '✅' ELSE '❌' END as question
FROM information_schema.columns 
WHERE table_name = 'review_questions'
  AND column_name IN (
    'unique_batch_id', 'auth_user_id', 'answer_status', 'ai_response_answers',
    'batch_faq_pairs', 'unique_batch_cluster', 'batch_date', 'organisation',
    'market_name', 'audience_name', 'persona_name', 'product_name',
    'organisation_jsonld_object', 'product_jsonld_object', 'persona_jsonld',
    'topic', 'question'
  );

-- 3. Check if there are any missing fields by comparing with what our edge function needs
SELECT 
    'unique_batch_id' as required_field,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'review_questions' AND column_name = 'unique_batch_id'
    ) THEN '✅ Present' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
    'auth_user_id' as required_field,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'review_questions' AND column_name = 'auth_user_id'
    ) THEN '✅ Present' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
    'answer_status' as required_field,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'review_questions' AND column_name = 'answer_status'
    ) THEN '✅ Present' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
    'ai_response_answers' as required_field,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'review_questions' AND column_name = 'ai_response_answers'
    ) THEN '✅ Present' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
    'batch_faq_pairs' as required_field,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'review_questions' AND column_name = 'batch_faq_pairs'
    ) THEN '✅ Present' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
    'unique_batch_cluster' as required_field,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'review_questions' AND column_name = 'unique_batch_cluster'
    ) THEN '✅ Present' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
    'batch_date' as required_field,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'review_questions' AND column_name = 'batch_date'
    ) THEN '✅ Present' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
    'organisation' as required_field,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'review_questions' AND column_name = 'organisation'
    ) THEN '✅ Present' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
    'market_name' as required_field,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'review_questions' AND column_name = 'market_name'
    ) THEN '✅ Present' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
    'audience_name' as required_field,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'review_questions' AND column_name = 'audience_name'
    ) THEN '✅ Present' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
    'persona_name' as required_field,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'review_questions' AND column_name = 'persona_name'
    ) THEN '✅ Present' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
    'product_name' as required_field,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'review_questions' AND column_name = 'product_name'
    ) THEN '✅ Present' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
    'organisation_jsonld_object' as required_field,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'review_questions' AND column_name = 'organisation_jsonld_object'
    ) THEN '✅ Present' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
    'product_jsonld_object' as required_field,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'review_questions' AND column_name = 'product_jsonld_object'
    ) THEN '✅ Present' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
    'persona_jsonld' as required_field,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'review_questions' AND column_name = 'persona_jsonld'
    ) THEN '✅ Present' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
    'topic' as required_field,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'review_questions' AND column_name = 'topic'
    ) THEN '✅ Present' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
    'question' as required_field,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'review_questions' AND column_name = 'question'
    ) THEN '✅ Present' ELSE '❌ Missing' END as status; 