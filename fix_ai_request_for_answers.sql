-- Fix missing ai_request_for_answers field
-- This function generates the AI request prompt for answer generation

-- 1. Create function to generate AI request for answers
CREATE OR REPLACE FUNCTION generate_ai_request_for_answers(
    p_unique_batch_id TEXT,
    p_batch_faq_pairs INTEGER,
    p_organisation TEXT,
    p_market_name TEXT,
    p_audience_name TEXT,
    p_persona_jsonld TEXT,
    p_product_jsonld_object TEXT,
    p_question TEXT,
    p_topic TEXT
) RETURNS TEXT AS $$
BEGIN
    RETURN CONCAT(
        'uniqueBatchId: ', p_unique_batch_id,
        ', faqCountInBatch: ', p_batch_faq_pairs,
        ', organisation: ', p_organisation,
        ', industry: ', p_market_name,
        ', audience: ', p_audience_name,
        ', topic: ', p_topic,
        ', question: ', p_question,
        ', product persona: ', p_persona_jsonld,
        ', product: ', p_product_jsonld_object
    );
END;
$$ LANGUAGE plpgsql;

-- 2. Create trigger function to automatically populate ai_request_for_answers
CREATE OR REPLACE FUNCTION populate_ai_request_for_answers()
RETURNS TRIGGER AS $$
DECLARE
    batch_info RECORD;
BEGIN
    -- Get batch information from construct_faq_pairs
    SELECT 
        unique_batch_id,
        total_faq_pairs,
        organisation,
        market_name,
        audience_name,
        persona_jsonld,
        product_jsonld_object
    INTO batch_info
    FROM construct_faq_pairs
    WHERE unique_batch_id = NEW.unique_batch_id
    LIMIT 1;
    
    -- Generate the AI request for answers
    NEW.ai_request_for_answers := generate_ai_request_for_answers(
        batch_info.unique_batch_id,
        batch_info.total_faq_pairs,
        batch_info.organisation,
        batch_info.market_name,
        batch_info.audience_name,
        batch_info.persona_jsonld,
        batch_info.product_jsonld_object,
        NEW.question,
        NEW.topic
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger to automatically populate ai_request_for_answers
DROP TRIGGER IF EXISTS tr_populate_ai_request_for_answers ON review_questions;
CREATE TRIGGER tr_populate_ai_request_for_answers
    BEFORE INSERT OR UPDATE ON review_questions
    FOR EACH ROW
    EXECUTE FUNCTION populate_ai_request_for_answers();

-- 4. Update existing records that have null ai_request_for_answers
UPDATE review_questions 
SET ai_request_for_answers = generate_ai_request_for_answers(
    unique_batch_id,
    COALESCE(batch_faq_pairs, 0),
    organisation,
    market_name,
    audience_name,
    persona_jsonld,
    product_jsonld_object,
    question,
    topic
)
WHERE ai_request_for_answers IS NULL
AND unique_batch_id IS NOT NULL
AND question IS NOT NULL;

-- 5. Verify the update worked
SELECT 
    COUNT(*) as total_questions,
    COUNT(CASE WHEN ai_request_for_answers IS NOT NULL THEN 1 END) as with_ai_request,
    COUNT(CASE WHEN ai_request_for_answers IS NULL THEN 1 END) as without_ai_request
FROM review_questions;

-- 6. Show sample of updated records
SELECT 
    id,
    unique_batch_id,
    LEFT(ai_request_for_answers, 100) as ai_request_preview,
    question_status,
    answer_status
FROM review_questions 
WHERE ai_request_for_answers IS NOT NULL
ORDER BY created_at DESC
LIMIT 5; 