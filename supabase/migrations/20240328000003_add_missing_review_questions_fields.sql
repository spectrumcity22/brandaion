-- Add any missing fields to review_questions table for edge function compatibility
-- Based on the actual table schema, most fields are already present

-- Add question field if it doesn't exist (some migrations use question_text, others use question)
-- Note: The actual table shows 'question' is already present, but this ensures compatibility
ALTER TABLE public.review_questions 
ADD COLUMN IF NOT EXISTS question text;

-- Update question field from question_text if question is null but question_text exists
-- This handles any legacy data that might use question_text
UPDATE public.review_questions 
SET question = question_text 
WHERE question IS NULL AND question_text IS NOT NULL;

-- Add indexes for better performance on commonly queried fields
CREATE INDEX IF NOT EXISTS idx_review_questions_persona_name ON public.review_questions(persona_name);
CREATE INDEX IF NOT EXISTS idx_review_questions_question ON public.review_questions(question);

-- Add comment to document the table structure
COMMENT ON TABLE public.review_questions IS 'Stores individual questions for review with all necessary context for FAQ batch generation';

-- Verify all required fields are present
-- This query should return all ✅ if everything is set up correctly
SELECT 
    'unique_batch_id' as field, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_questions' AND column_name = 'unique_batch_id') THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    'auth_user_id' as field, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_questions' AND column_name = 'auth_user_id') THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    'answer_status' as field, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_questions' AND column_name = 'answer_status') THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    'ai_response_answers' as field, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_questions' AND column_name = 'ai_response_answers') THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    'batch_faq_pairs' as field, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_questions' AND column_name = 'batch_faq_pairs') THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    'unique_batch_cluster' as field, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_questions' AND column_name = 'unique_batch_cluster') THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    'batch_date' as field, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_questions' AND column_name = 'batch_date') THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    'organisation' as field, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_questions' AND column_name = 'organisation') THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    'market_name' as field, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_questions' AND column_name = 'market_name') THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    'audience_name' as field, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_questions' AND column_name = 'audience_name') THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    'persona_name' as field, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_questions' AND column_name = 'persona_name') THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    'product_name' as field, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_questions' AND column_name = 'product_name') THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    'organisation_jsonld_object' as field, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_questions' AND column_name = 'organisation_jsonld_object') THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    'product_jsonld_object' as field, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_questions' AND column_name = 'product_jsonld_object') THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    'persona_jsonld' as field, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_questions' AND column_name = 'persona_jsonld') THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    'topic' as field, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_questions' AND column_name = 'topic') THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    'question' as field, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_questions' AND column_name = 'question') THEN '✅' ELSE '❌' END as status; 