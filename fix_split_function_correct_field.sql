-- Fix the split_questions_into_review function to use batch_faq_pairs instead of total_faq_pairs
-- batch_faq_pairs = FAQs in this specific batch (5)
-- total_faq_pairs = Total FAQs in the cluster (20)

-- Update the function to use the correct field
CREATE OR REPLACE FUNCTION public.split_questions_into_review()
RETURNS TRIGGER AS $$
DECLARE
    question_line TEXT;
    clean_question TEXT;
    topic_name TEXT;
    question_text TEXT;
    bracket_pos INTEGER;
BEGIN
    -- Only process when question_status changes to 'questions_generated'
    IF NEW.question_status = 'questions_generated' AND NEW.ai_response_questions IS NOT NULL THEN
        
        -- Clear any existing questions for this construct_faq_pair (in case of re-processing)
        DELETE FROM review_questions WHERE unique_batch_id = NEW.unique_batch_id;
        
        -- Split by newlines and process each line
        FOR question_line IN SELECT unnest(string_to_array(NEW.ai_response_questions, E'\n'))
        LOOP
            -- Clean the line (remove numbering, trim whitespace)
            clean_question := trim(regexp_replace(question_line, '^[0-9]+\.\s*', ''));
            
            -- Only process if we have actual content and the correct format
            IF length(clean_question) > 10 AND clean_question ~ '^\[.+?\]\[.+?\]$' THEN
                
                -- Extract topic name (text between first [ and first ])
                topic_name := substring(clean_question from '^\[([^\]]+)\]');
                
                -- Extract question text (text between second [ and last ])
                question_text := substring(clean_question from '\[([^\]]+)\]$');
                
                -- Only insert if we successfully extracted both topic and question
                IF topic_name IS NOT NULL AND question_text IS NOT NULL AND length(topic_name) > 0 AND length(question_text) > 0 THEN
                    INSERT INTO review_questions (
                        unique_batch_cluster,
                        unique_batch_id,
                        batch_date,
                        batch_faq_pairs,  -- Use batch_faq_pairs (not total_faq_pairs)
                        organisation,
                        user_email,
                        auth_user_id,
                        product_name,
                        persona_name,
                        audience_name,
                        market_name,
                        question,
                        topic,
                        answer_status,
                        question_status,
                        persona_jsonld,
                        product_jsonld_object,
                        organisation_jsonld_object
                    ) VALUES (
                        NEW.unique_batch_cluster,
                        NEW.unique_batch_id,
                        NEW.batch_date,
                        NEW.batch_faq_pairs,  -- Use batch_faq_pairs (not total_faq_pairs)
                        NEW.organisation,
                        NEW.user_email,
                        NEW.auth_user_id,
                        NEW.product_name,
                        NEW.persona_name,
                        NEW.audience_name,
                        NEW.market_name,
                        question_text,
                        topic_name,
                        'pending',
                        NEW.question_status,
                        NEW.persona_jsonld,
                        NEW.product_jsonld_object,
                        NEW.brand_jsonld_object
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the function was updated correctly
SELECT 
    'Function Updated' as check_type,
    p.proname as function_name,
    CASE 
        WHEN p.prosrc LIKE '%batch_faq_pairs%' AND p.prosrc NOT LIKE '%total_faq_pairs%' THEN '✅ PASS - Using batch_faq_pairs correctly'
        WHEN p.prosrc LIKE '%total_faq_pairs%' THEN '❌ FAIL - Still using total_faq_pairs'
        ELSE '⚠️ WARNING - Check function manually'
    END as field_usage_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'split_questions_into_review';

-- Test with sample data to show the difference
SELECT 
    'Field Comparison' as check_type,
    unique_batch_id,
    batch_faq_pairs as batch_size,
    total_faq_pairs as cluster_total,
    'batch_faq_pairs should be used for validation' as note
FROM construct_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
  AND batch_faq_pairs IS NOT NULL
ORDER BY created_at DESC
LIMIT 3; 