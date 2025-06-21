-- Create FAQ Performance Logs table for tracking test results and costs
CREATE TABLE IF NOT EXISTS public.faq_performance_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id),
    test_date TIMESTAMPTZ DEFAULT NOW(),
    ai_provider TEXT NOT NULL CHECK (ai_provider IN ('openai', 'perplexity', 'gemini', 'claude', 'custom')),
    question_id UUID REFERENCES review_questions(id),
    question_text TEXT NOT NULL,
    expected_answer TEXT NOT NULL,
    ai_response TEXT,
    response_time_ms INTEGER,
    accuracy_score DECIMAL(5,2),
    token_usage INTEGER,
    cost_usd DECIMAL(10,4),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'error', 'timeout')),
    error_message TEXT,
    test_schedule TEXT CHECK (test_schedule IN ('manual', 'weekly', 'monthly')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_faq_performance_logs_auth_user_id ON public.faq_performance_logs(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_faq_performance_logs_test_date ON public.faq_performance_logs(test_date);
CREATE INDEX IF NOT EXISTS idx_faq_performance_logs_ai_provider ON public.faq_performance_logs(ai_provider);
CREATE INDEX IF NOT EXISTS idx_faq_performance_logs_status ON public.faq_performance_logs(status);

-- Enable RLS
ALTER TABLE public.faq_performance_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own performance logs"
    ON public.faq_performance_logs
    FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert their own performance logs"
    ON public.faq_performance_logs
    FOR INSERT
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own performance logs"
    ON public.faq_performance_logs
    FOR UPDATE
    USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);

-- Create FAQ Performance Settings table for user preferences
CREATE TABLE IF NOT EXISTS public.faq_performance_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
    enabled_providers TEXT[] DEFAULT ARRAY['openai']::TEXT[],
    test_schedule TEXT DEFAULT 'manual' CHECK (test_schedule IN ('manual', 'weekly', 'monthly')),
    weekly_test_day INTEGER DEFAULT 1 CHECK (weekly_test_day BETWEEN 1 AND 7), -- 1=Monday, 7=Sunday
    monthly_test_day INTEGER DEFAULT 1 CHECK (monthly_test_day BETWEEN 1 AND 31),
    max_tokens_per_test INTEGER DEFAULT 1000,
    max_cost_per_month DECIMAL(10,2) DEFAULT 50.00,
    auto_test_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for settings
CREATE INDEX IF NOT EXISTS idx_faq_performance_settings_auth_user_id ON public.faq_performance_settings(auth_user_id);

-- Enable RLS for settings
ALTER TABLE public.faq_performance_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for settings
CREATE POLICY "Users can view their own performance settings"
    ON public.faq_performance_settings
    FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert their own performance settings"
    ON public.faq_performance_settings
    FOR INSERT
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own performance settings"
    ON public.faq_performance_settings
    FOR UPDATE
    USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);

-- Create updated_at trigger for settings
CREATE OR REPLACE FUNCTION update_faq_performance_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_faq_performance_settings_updated_at
    BEFORE UPDATE ON public.faq_performance_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_faq_performance_settings_updated_at(); 