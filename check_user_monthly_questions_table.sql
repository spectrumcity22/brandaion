-- Check if user_monthly_questions table exists and has correct structure
-- This table should have been created by migration 20240329000002_create_monthly_selection_tables.sql

-- Check if table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_monthly_questions'
) as table_exists;

-- If table doesn't exist, create it
CREATE TABLE IF NOT EXISTS public.user_monthly_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES public.review_questions(id) ON DELETE CASCADE,
    package_tier VARCHAR(20) NOT NULL CHECK (package_tier IN ('pack1', 'pack2', 'pack3', 'pack4')),
    added_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, question_id)
);

-- Check table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_monthly_questions'
ORDER BY ordinal_position;

-- Enable RLS if not already enabled
ALTER TABLE public.user_monthly_questions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they don't exist
DO $$
BEGIN
    -- Users can view their own monthly questions
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_monthly_questions' 
        AND policyname = 'Users can view their own monthly questions'
    ) THEN
        CREATE POLICY "Users can view their own monthly questions"
            ON public.user_monthly_questions
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    -- Users can insert their own monthly questions
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_monthly_questions' 
        AND policyname = 'Users can insert their own monthly questions'
    ) THEN
        CREATE POLICY "Users can insert their own monthly questions"
            ON public.user_monthly_questions
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Users can update their own monthly questions
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_monthly_questions' 
        AND policyname = 'Users can update their own monthly questions'
    ) THEN
        CREATE POLICY "Users can update their own monthly questions"
            ON public.user_monthly_questions
            FOR UPDATE
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Users can delete their own monthly questions
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_monthly_questions' 
        AND policyname = 'Users can delete their own monthly questions'
    ) THEN
        CREATE POLICY "Users can delete their own monthly questions"
            ON public.user_monthly_questions
            FOR DELETE
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_monthly_questions_user_id ON public.user_monthly_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_monthly_questions_active ON public.user_monthly_questions(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_monthly_questions_package ON public.user_monthly_questions(package_tier);

-- Create trigger for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_monthly_questions_updated_at
    BEFORE UPDATE ON public.user_monthly_questions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column(); 