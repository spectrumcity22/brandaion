-- Create tables for automated FAQ testing system

-- User testing settings table
CREATE TABLE public.user_testing_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    package_tier VARCHAR DEFAULT 'basic' CHECK (package_tier IN ('basic', 'standard', 'premium', 'enterprise')),
    questions_per_month INTEGER DEFAULT 5 CHECK (questions_per_month IN (5, 10, 15, 20)),
    enabled_providers TEXT[] DEFAULT ARRAY['openai'] CHECK (array_length(enabled_providers, 1) > 0),
    is_active BOOLEAN DEFAULT true,
    first_test_date DATE,
    last_test_date DATE,
    next_test_date DATE,
    test_schedule VARCHAR DEFAULT 'monthly' CHECK (test_schedule IN ('monthly', 'weekly', 'bi-weekly')),
    subscription_expires_at DATE,
    testing_paused_at DATE,
    grace_period_days INTEGER DEFAULT 7,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User test questions table
CREATE TABLE public.user_test_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES public.review_questions(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, question_id)
);

-- Update existing faq_performance_logs table to add test_month and response_analysis fields
ALTER TABLE public.faq_performance_logs 
ADD COLUMN IF NOT EXISTS test_month DATE,
ADD COLUMN IF NOT EXISTS response_analysis JSONB;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_testing_settings_next_test_date ON public.user_testing_settings(next_test_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_testing_settings_user_id ON public.user_testing_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_test_questions_user_id ON public.user_test_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_test_questions_active ON public.user_test_questions(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_faq_performance_logs_test_month ON public.faq_performance_logs(test_month);
CREATE INDEX IF NOT EXISTS idx_faq_performance_logs_user_id ON public.faq_performance_logs(user_id);

-- Create RLS policies
ALTER TABLE public.user_testing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_test_questions ENABLE ROW LEVEL SECURITY;

-- User testing settings policies
CREATE POLICY "Users can view their own testing settings" ON public.user_testing_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own testing settings" ON public.user_testing_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own testing settings" ON public.user_testing_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- User test questions policies
CREATE POLICY "Users can view their own test questions" ON public.user_test_questions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own test questions" ON public.user_test_questions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own test questions" ON public.user_test_questions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own test questions" ON public.user_test_questions
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user_testing_settings
CREATE TRIGGER update_user_testing_settings_updated_at
    BEFORE UPDATE ON public.user_testing_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column(); 