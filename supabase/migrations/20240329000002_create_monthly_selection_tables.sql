-- Create tables for monthly FAQ performance monitoring system

-- Table to track user's monthly question selections
CREATE TABLE IF NOT EXISTS public.user_monthly_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES public.review_questions(id) ON DELETE CASCADE,
    package_tier VARCHAR(20) NOT NULL CHECK (package_tier IN ('startup', 'growth', 'pro', 'enterprise')),
    added_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, question_id)
);

-- Table to track user's monthly LLM selections
CREATE TABLE IF NOT EXISTS public.user_monthly_llms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    llm_provider TEXT NOT NULL CHECK (llm_provider IN ('openai', 'gemini', 'perplexity', 'claude')),
    package_tier VARCHAR(20) NOT NULL CHECK (package_tier IN ('startup', 'growth', 'pro', 'enterprise')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, llm_provider)
);

-- Table to track user's monthly schedule
CREATE TABLE IF NOT EXISTS public.user_monthly_schedule (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    first_schedule_date DATE NOT NULL DEFAULT CURRENT_DATE,
    next_test_date DATE NOT NULL DEFAULT CURRENT_DATE,
    package_tier VARCHAR(20) NOT NULL CHECK (package_tier IN ('startup', 'growth', 'pro', 'enterprise')),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'paused', 'cancelled')),
    last_test_month DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_monthly_questions_user_id ON public.user_monthly_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_monthly_questions_active ON public.user_monthly_questions(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_monthly_questions_package ON public.user_monthly_questions(package_tier);

CREATE INDEX IF NOT EXISTS idx_user_monthly_llms_user_id ON public.user_monthly_llms(user_id);
CREATE INDEX IF NOT EXISTS idx_user_monthly_llms_active ON public.user_monthly_llms(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_monthly_llms_package ON public.user_monthly_llms(package_tier);

CREATE INDEX IF NOT EXISTS idx_user_monthly_schedule_next_test ON public.user_monthly_schedule(next_test_date) WHERE subscription_status = 'active';
CREATE INDEX IF NOT EXISTS idx_user_monthly_schedule_user_id ON public.user_monthly_schedule(user_id);

-- Enable RLS
ALTER TABLE public.user_monthly_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_monthly_llms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_monthly_schedule ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_monthly_questions
CREATE POLICY "Users can view their own monthly questions"
    ON public.user_monthly_questions
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monthly questions"
    ON public.user_monthly_questions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monthly questions"
    ON public.user_monthly_questions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own monthly questions"
    ON public.user_monthly_questions
    FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for user_monthly_llms
CREATE POLICY "Users can view their own monthly LLMs"
    ON public.user_monthly_llms
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monthly LLMs"
    ON public.user_monthly_llms
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monthly LLMs"
    ON public.user_monthly_llms
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own monthly LLMs"
    ON public.user_monthly_llms
    FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for user_monthly_schedule
CREATE POLICY "Users can view their own monthly schedule"
    ON public.user_monthly_schedule
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monthly schedule"
    ON public.user_monthly_schedule
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monthly schedule"
    ON public.user_monthly_schedule
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_user_monthly_questions_updated_at
    BEFORE UPDATE ON public.user_monthly_questions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_monthly_llms_updated_at
    BEFORE UPDATE ON public.user_monthly_llms
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_monthly_schedule_updated_at
    BEFORE UPDATE ON public.user_monthly_schedule
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get package limits
CREATE OR REPLACE FUNCTION get_package_limits(package_tier VARCHAR)
RETURNS TABLE(questions_limit INTEGER, llms_limit INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE package_tier
            WHEN 'startup' THEN 5
            WHEN 'growth' THEN 10
            WHEN 'pro' THEN 15
            WHEN 'enterprise' THEN 20
            ELSE 5
        END as questions_limit,
        CASE package_tier
            WHEN 'startup' THEN 1
            WHEN 'growth' THEN 2
            WHEN 'pro' THEN 3
            WHEN 'enterprise' THEN 4
            ELSE 1
        END as llms_limit;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE public.user_monthly_questions IS 'Tracks which questions users have selected for monthly performance monitoring';
COMMENT ON TABLE public.user_monthly_llms IS 'Tracks which LLMs users have selected for monthly performance testing';
COMMENT ON TABLE public.user_monthly_schedule IS 'Tracks user monthly testing schedule and subscription status';
COMMENT ON FUNCTION get_package_limits(VARCHAR) IS 'Returns the question and LLM limits for a given package tier'; 