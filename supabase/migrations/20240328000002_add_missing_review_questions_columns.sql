-- Add missing columns to review_questions table
-- These columns are expected by the frontend but missing from the current table structure

-- Add topic column
ALTER TABLE public.review_questions 
ADD COLUMN IF NOT EXISTS topic text;

-- Add batch-related columns
ALTER TABLE public.review_questions 
ADD COLUMN IF NOT EXISTS unique_batch_id text,
ADD COLUMN IF NOT EXISTS unique_batch_cluster text,
ADD COLUMN IF NOT EXISTS batch_date date,
ADD COLUMN IF NOT EXISTS batch_faq_pairs integer;

-- Add organisation and product columns
ALTER TABLE public.review_questions 
ADD COLUMN IF NOT EXISTS organisation text,
ADD COLUMN IF NOT EXISTS product_name text,
ADD COLUMN IF NOT EXISTS audience_name text,
ADD COLUMN IF NOT EXISTS market_name text;

-- Add JSON-LD columns
ALTER TABLE public.review_questions 
ADD COLUMN IF NOT EXISTS organisation_jsonld_object jsonb,
ADD COLUMN IF NOT EXISTS product_jsonld_object jsonb,
ADD COLUMN IF NOT EXISTS persona_jsonld jsonb;

-- Add question and answer status columns
ALTER TABLE public.review_questions 
ADD COLUMN IF NOT EXISTS question_status text DEFAULT 'pending' CHECK (question_status IN ('pending', 'questions_generated', 'question_approved', 'edited')),
ADD COLUMN IF NOT EXISTS answer_status text DEFAULT 'pending' CHECK (answer_status IN ('pending', 'generating', 'completed', 'failed'));

-- Add AI response columns
ALTER TABLE public.review_questions 
ADD COLUMN IF NOT EXISTS ai_response_answers text;

-- Add auth_user_id for RLS
ALTER TABLE public.review_questions 
ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_review_questions_unique_batch_id ON public.review_questions(unique_batch_id);
CREATE INDEX IF NOT EXISTS idx_review_questions_auth_user_id ON public.review_questions(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_review_questions_question_status ON public.review_questions(question_status);
CREATE INDEX IF NOT EXISTS idx_review_questions_answer_status ON public.review_questions(answer_status);

-- Update the split_questions_into_review function to populate the new columns
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
                -- Insert each question as a separate row with all available data
                INSERT INTO public.review_questions (
                    construct_faq_pair_id,
                    topic,
                    question_text,
                    status,
                    question_status,
                    unique_batch_id,
                    unique_batch_cluster,
                    batch_date,
                    batch_faq_pairs,
                    organisation,
                    product_name,
                    audience_name,
                    market_name,
                    organisation_jsonld_object,
                    product_jsonld_object,
                    persona_jsonld,
                    auth_user_id
                ) VALUES (
                    NEW.id,
                    topic_record->>'topic',
                    question_record->>'question',
                    'pending',
                    'questions_generated',
                    NEW.unique_batch_id,
                    NEW.unique_batch_cluster,
                    NEW.batch_date,
                    NEW.batch_faq_pairs,
                    NEW.organisation,
                    NEW.product_name,
                    NEW.audience_name,
                    NEW.market_name,
                    NEW.brand_jsonld_object,
                    NEW.product_jsonld_object,
                    NEW.persona_jsonld,
                    NEW.auth_user_id
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