-- Check and create all monthly tables needed for FAQ performance system

-- 1. Check and create user_monthly_llms table
CREATE TABLE IF NOT EXISTS public.user_monthly_llms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    llm_provider TEXT NOT NULL CHECK (llm_provider IN ('openai', 'gemini', 'perplexity', 'claude')),
    package_tier VARCHAR(20) NOT NULL CHECK (package_tier IN ('pack1', 'pack2', 'pack3', 'pack4')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, llm_provider)
);

-- 2. Check and create user_monthly_schedule table
CREATE TABLE IF NOT EXISTS public.user_monthly_schedule (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    first_schedule_date DATE NOT NULL DEFAULT CURRENT_DATE,
    next_test_date DATE NOT NULL DEFAULT CURRENT_DATE,
    package_tier VARCHAR(20) NOT NULL CHECK (package_tier IN ('pack1', 'pack2', 'pack3', 'pack4')),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'paused', 'cancelled')),
    last_test_month DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for all tables
ALTER TABLE public.user_monthly_llms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_monthly_schedule ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_monthly_llms
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_monthly_llms' 
        AND policyname = 'Users can view their own monthly LLMs'
    ) THEN
        CREATE POLICY "Users can view their own monthly LLMs"
            ON public.user_monthly_llms
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_monthly_llms' 
        AND policyname = 'Users can insert their own monthly LLMs'
    ) THEN
        CREATE POLICY "Users can insert their own monthly LLMs"
            ON public.user_monthly_llms
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_monthly_llms' 
        AND policyname = 'Users can update their own monthly LLMs'
    ) THEN
        CREATE POLICY "Users can update their own monthly LLMs"
            ON public.user_monthly_llms
            FOR UPDATE
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_monthly_llms' 
        AND policyname = 'Users can delete their own monthly LLMs'
    ) THEN
        CREATE POLICY "Users can delete their own monthly LLMs"
            ON public.user_monthly_llms
            FOR DELETE
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- Create RLS policies for user_monthly_schedule
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_monthly_schedule' 
        AND policyname = 'Users can view their own monthly schedule'
    ) THEN
        CREATE POLICY "Users can view their own monthly schedule"
            ON public.user_monthly_schedule
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_monthly_schedule' 
        AND policyname = 'Users can insert their own monthly schedule'
    ) THEN
        CREATE POLICY "Users can insert their own monthly schedule"
            ON public.user_monthly_schedule
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_monthly_schedule' 
        AND policyname = 'Users can update their own monthly schedule'
    ) THEN
        CREATE POLICY "Users can update their own monthly schedule"
            ON public.user_monthly_schedule
            FOR UPDATE
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_monthly_llms_user_id ON public.user_monthly_llms(user_id);
CREATE INDEX IF NOT EXISTS idx_user_monthly_llms_active ON public.user_monthly_llms(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_monthly_llms_package ON public.user_monthly_llms(package_tier);

CREATE INDEX IF NOT EXISTS idx_user_monthly_schedule_next_test ON public.user_monthly_schedule(next_test_date) WHERE subscription_status = 'active';
CREATE INDEX IF NOT EXISTS idx_user_monthly_schedule_user_id ON public.user_monthly_schedule(user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_user_monthly_llms_updated_at
    BEFORE UPDATE ON public.user_monthly_llms
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_monthly_schedule_updated_at
    BEFORE UPDATE ON public.user_monthly_schedule
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Check what tables exist
SELECT 
    table_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = t.table_name
    ) as exists
FROM (VALUES 
    ('user_monthly_questions'),
    ('user_monthly_llms'), 
    ('user_monthly_schedule')
) AS t(table_name); 