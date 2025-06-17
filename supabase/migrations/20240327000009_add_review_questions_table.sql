-- Create review_questions table
CREATE TABLE IF NOT EXISTS review_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    construct_faq_pair_id UUID REFERENCES construct_faq_pairs(id),
    topic TEXT NOT NULL,
    question_text TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'edited')),
    edited_question TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create function to split questions into review_questions
CREATE OR REPLACE FUNCTION split_questions_into_review()
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
                INSERT INTO review_questions (
                    construct_faq_pair_id,
                    topic,
                    question_text,
                    status
                ) VALUES (
                    NEW.id,
                    topic_record->>'topic',
                    question_record->>'question',
                    'pending'
                );
            END LOOP;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically split questions
CREATE TRIGGER tr_split_questions
    AFTER UPDATE ON construct_faq_pairs
    FOR EACH ROW
    EXECUTE FUNCTION split_questions_into_review();

-- Add RLS policies
ALTER TABLE review_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own review questions"
    ON review_questions
    FOR SELECT
    USING (
        construct_faq_pair_id IN (
            SELECT id FROM construct_faq_pairs WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own review questions"
    ON review_questions
    FOR UPDATE
    USING (
        construct_faq_pair_id IN (
            SELECT id FROM construct_faq_pairs WHERE auth_user_id = auth.uid()
        )
    ); 