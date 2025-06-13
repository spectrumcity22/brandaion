-- Add status columns to construct_faq_pairs
ALTER TABLE public.construct_faq_pairs
ADD COLUMN IF NOT EXISTS generation_status text DEFAULT 'pending' CHECK (generation_status IN ('pending', 'generating_questions', 'questions_generated', 'generating_answers', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS error_message text;

-- Create client_faq_pairs table
CREATE TABLE IF NOT EXISTS public.client_faq_pairs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    construct_faq_pair_id uuid REFERENCES public.construct_faq_pairs(id),
    question text NOT NULL,
    answer text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.client_faq_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own FAQ pairs"
    ON public.client_faq_pairs
    FOR SELECT
    USING (
        construct_faq_pair_id IN (
            SELECT id FROM public.construct_faq_pairs
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own FAQ pairs"
    ON public.client_faq_pairs
    FOR UPDATE
    USING (
        construct_faq_pair_id IN (
            SELECT id FROM public.construct_faq_pairs
            WHERE auth_user_id = auth.uid()
        )
    ); 