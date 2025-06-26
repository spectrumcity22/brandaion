-- Fix existing approved questions that are missing ai_request_for_answers
-- This uses the same function but updates existing records

-- First, show how many questions need fixing
SELECT 
    'Questions to Fix' as check_type,
    COUNT(*) as count,
    'Approved questions missing ai_request_for_answers' as description
FROM review_questions 
WHERE question_status = 'question_approved'
  AND (ai_request_for_answers IS NULL OR ai_request_for_answers = '');

-- Update all existing approved questions that are missing ai_request_for_answers
UPDATE review_questions 
SET 
    ai_request_for_answers = public.generate_ai_request_for_answers(
        unique_batch_id,
        batch_faq_pairs,
        organisation,
        market_name,
        audience_name,
        persona_jsonld,
        product_jsonld_object,
        question,
        topic
    ),
    answer_status = 'pending'
WHERE question_status = 'question_approved'
  AND (ai_request_for_answers IS NULL OR ai_request_for_answers = '')
  AND unique_batch_id IS NOT NULL;

-- Show the results of the update
SELECT 
    'Update Results' as check_type,
    COUNT(*) as total_approved_questions,
    COUNT(CASE WHEN ai_request_for_answers IS NOT NULL AND ai_request_for_answers != '' THEN 1 END) as questions_with_ai_request,
    COUNT(CASE WHEN answer_status = 'pending' THEN 1 END) as questions_ready_for_processing
FROM review_questions 
WHERE question_status = 'question_approved';

-- Show a sample of the fixed questions
SELECT 
    'Sample Fixed Questions' as check_type,
    id,
    unique_batch_id,
    question,
    topic,
    ai_request_for_answers IS NOT NULL as has_ai_request,
    LEFT(ai_request_for_answers, 100) as ai_request_preview,
    answer_status
FROM review_questions 
WHERE question_status = 'question_approved'
  AND ai_request_for_answers IS NOT NULL
  AND ai_request_for_answers != ''
ORDER BY updated_at DESC
LIMIT 3;

-- Verify that all approved questions now have ai_request_for_answers
SELECT 
    'Final Verification' as check_type,
    CASE 
        WHEN COUNT(CASE WHEN ai_request_for_answers IS NULL OR ai_request_for_answers = '' THEN 1 END) = 0 
        THEN '✅ All approved questions now have ai_request_for_answers'
        ELSE '❌ Some approved questions still missing ai_request_for_answers'
    END as status,
    COUNT(*) as total_approved_questions,
    COUNT(CASE WHEN ai_request_for_answers IS NOT NULL AND ai_request_for_answers != '' THEN 1 END) as questions_with_ai_request
FROM review_questions 
WHERE question_status = 'question_approved'; 