-- Create review_questions table
CREATE TABLE IF NOT EXISTS public.review_questions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    construct_faq_pair_id uuid REFERENCES public.construct_faq_pairs(id),
    question_text text NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'edited')),
    edited_question text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create review_answers table
CREATE TABLE IF NOT EXISTS public.review_answers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    review_question_id uuid REFERENCES public.review_questions(id),
    answer_text text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    error_message text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create faq_jsonld table for final output
CREATE TABLE IF NOT EXISTS public.faq_jsonld (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    construct_faq_pair_id uuid REFERENCES public.construct_faq_pairs(id),
    jsonld_object jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.review_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_jsonld ENABLE ROW LEVEL SECURITY;

-- Policies for review_questions
CREATE POLICY "Users can view their own review questions"
    ON public.review_questions
    FOR SELECT
    USING (
        construct_faq_pair_id IN (
            SELECT id FROM public.construct_faq_pairs
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own review questions"
    ON public.review_questions
    FOR UPDATE
    USING (
        construct_faq_pair_id IN (
            SELECT id FROM public.construct_faq_pairs
            WHERE auth_user_id = auth.uid()
        )
    );

-- Policies for review_answers
CREATE POLICY "Users can view their own review answers"
    ON public.review_answers
    FOR SELECT
    USING (
        review_question_id IN (
            SELECT id FROM public.review_questions
            WHERE construct_faq_pair_id IN (
                SELECT id FROM public.construct_faq_pairs
                WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Policies for faq_jsonld
CREATE POLICY "Users can view their own FAQ JSONLD"
    ON public.faq_jsonld
    FOR SELECT
    USING (
        construct_faq_pair_id IN (
            SELECT id FROM public.construct_faq_pairs
            WHERE auth_user_id = auth.uid()
        )
    ); 