-- Create batch_faq_pairs table for storing compiled FAQ batches
CREATE TABLE IF NOT EXISTS public.batch_faq_pairs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    unique_batch_id text NOT NULL,
    batch_date date NOT NULL,
    organisation text NOT NULL,
    product_name text NOT NULL,
    faq_pairs_object jsonb NOT NULL,
    batch_status text DEFAULT 'batch_generated' CHECK (batch_status IN ('batch_generated', 'batch_published')),
    auth_user_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create index for efficient batch lookups
CREATE INDEX IF NOT EXISTS idx_batch_faq_pairs_unique_batch_id ON public.batch_faq_pairs(unique_batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_faq_pairs_auth_user_id ON public.batch_faq_pairs(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_batch_faq_pairs_batch_status ON public.batch_faq_pairs(batch_status);

-- Add RLS policies
ALTER TABLE public.batch_faq_pairs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own batch FAQ pairs" ON public.batch_faq_pairs;
CREATE POLICY "Users can view their own batch FAQ pairs"
    ON public.batch_faq_pairs
    FOR SELECT
    USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own batch FAQ pairs" ON public.batch_faq_pairs;
CREATE POLICY "Users can update their own batch FAQ pairs"
    ON public.batch_faq_pairs
    FOR UPDATE
    USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own batch FAQ pairs" ON public.batch_faq_pairs;
CREATE POLICY "Users can insert their own batch FAQ pairs"
    ON public.batch_faq_pairs
    FOR INSERT
    WITH CHECK (auth_user_id = auth.uid());

-- Add comment
COMMENT ON TABLE public.batch_faq_pairs IS 'Stores compiled FAQ batches in LLM-friendly JSON format for training and retrieval'; 