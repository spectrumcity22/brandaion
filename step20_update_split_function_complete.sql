-- Step 20: Update the split_questions_into_review function to include all JSON-LD fields

-- Update the function to include all JSON-LD fields
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