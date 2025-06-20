-- Fix the split_questions_into_review function to match current table structure
-- The current review_questions table doesn't have a 'topic' column

CREATE OR REPLACE FUNCTION public.split_questions_into_review()
RETURNS TRIGGER AS $$
DECLARE
    topic_record JSONB;
    question_record JSONB;
BEGIN
    -- Only process if questions were generated
    IF NEW.generation_status = 'questions_generated' AND NEW.ai_response_questions IS NOT NULL THEN
        -- Loop through each topic
        FOR topic_record IN SELECT * FROM jsonb_array_elements(NEW.ai_response_questions->'topics')
        LOOP
            -- Loop through each question in the topic
            FOR question_record IN SELECT * FROM jsonb_array_elements(topic_record->'questions')
            LOOP
                -- Insert each question as a separate row
                -- Note: topic field is not included as it doesn't exist in current table structure
                INSERT INTO public.review_questions (
                    construct_faq_pair_id,
                    question_text,
                    status
                ) VALUES (
                    NEW.id,
                    question_record->>'question',
                    'pending'
                );
            END LOOP;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS tr_split_questions ON public.construct_faq_pairs;
CREATE TRIGGER tr_split_questions
    AFTER UPDATE ON public.construct_faq_pairs
    FOR EACH ROW
    EXECUTE FUNCTION public.split_questions_into_review(); 