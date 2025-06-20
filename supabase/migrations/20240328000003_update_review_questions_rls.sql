-- Update RLS policies for review_questions to use the new auth_user_id column
-- This provides better performance and simpler policies

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own review questions" ON public.review_questions;
DROP POLICY IF EXISTS "Users can update their own review questions" ON public.review_questions;

-- Create new policies using auth_user_id for better performance
CREATE POLICY "Users can view their own review questions"
    ON public.review_questions
    FOR SELECT
    USING (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own review questions"
    ON public.review_questions
    FOR UPDATE
    USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own review questions"
    ON public.review_questions
    FOR INSERT
    WITH CHECK (auth_user_id = auth.uid());

-- Add comment to explain the change
COMMENT ON TABLE public.review_questions IS 'Updated RLS policies to use auth_user_id for better performance'; 