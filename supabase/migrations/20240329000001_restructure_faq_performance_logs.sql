-- Migration to restructure faq_performance_logs for individual LLM tracking
-- This allows tracking responses from multiple LLMs in a single test

-- Step 1: Add new columns for individual LLM responses
ALTER TABLE public.faq_performance_logs 
ADD COLUMN IF NOT EXISTS openai_response TEXT,
ADD COLUMN IF NOT EXISTS gemini_response TEXT,
ADD COLUMN IF NOT EXISTS perplexity_response TEXT,
ADD COLUMN IF NOT EXISTS claude_response TEXT;

-- Step 2: Add new columns for individual LLM accuracy scores
ALTER TABLE public.faq_performance_logs 
ADD COLUMN IF NOT EXISTS openai_accuracy_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS gemini_accuracy_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS perplexity_accuracy_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS claude_accuracy_score DECIMAL(5,2);

-- Step 3: Add new columns for individual LLM costs
ALTER TABLE public.faq_performance_logs 
ADD COLUMN IF NOT EXISTS openai_cost_usd DECIMAL(10,4),
ADD COLUMN IF NOT EXISTS gemini_cost_usd DECIMAL(10,4),
ADD COLUMN IF NOT EXISTS perplexity_cost_usd DECIMAL(10,4),
ADD COLUMN IF NOT EXISTS claude_cost_usd DECIMAL(10,4);

-- Step 4: Add new columns for individual LLM token usage
ALTER TABLE public.faq_performance_logs 
ADD COLUMN IF NOT EXISTS openai_token_usage INTEGER,
ADD COLUMN IF NOT EXISTS gemini_token_usage INTEGER,
ADD COLUMN IF NOT EXISTS perplexity_token_usage INTEGER,
ADD COLUMN IF NOT EXISTS claude_token_usage INTEGER;

-- Step 5: Add new columns for individual LLM response times
ALTER TABLE public.faq_performance_logs 
ADD COLUMN IF NOT EXISTS openai_response_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS gemini_response_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS perplexity_response_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS claude_response_time_ms INTEGER;

-- Step 6: Add new columns for individual LLM status and error messages
ALTER TABLE public.faq_performance_logs 
ADD COLUMN IF NOT EXISTS openai_status TEXT DEFAULT 'pending' CHECK (openai_status IN ('pending', 'success', 'error', 'timeout')),
ADD COLUMN IF NOT EXISTS gemini_status TEXT DEFAULT 'pending' CHECK (gemini_status IN ('pending', 'success', 'error', 'timeout')),
ADD COLUMN IF NOT EXISTS perplexity_status TEXT DEFAULT 'pending' CHECK (perplexity_status IN ('pending', 'success', 'error', 'timeout')),
ADD COLUMN IF NOT EXISTS claude_status TEXT DEFAULT 'pending' CHECK (claude_status IN ('pending', 'success', 'error', 'timeout'));

ALTER TABLE public.faq_performance_logs 
ADD COLUMN IF NOT EXISTS openai_error_message TEXT,
ADD COLUMN IF NOT EXISTS gemini_error_message TEXT,
ADD COLUMN IF NOT EXISTS perplexity_error_message TEXT,
ADD COLUMN IF NOT EXISTS claude_error_message TEXT;

-- Step 7: Add columns for tracking which LLMs were tested
ALTER TABLE public.faq_performance_logs 
ADD COLUMN IF NOT EXISTS tested_llms TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS test_month DATE;

-- Step 8: Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_faq_performance_logs_test_month ON public.faq_performance_logs(test_month);
CREATE INDEX IF NOT EXISTS idx_faq_performance_logs_tested_llms ON public.faq_performance_logs USING GIN(tested_llms);

-- Step 9: Create indexes for individual LLM status columns
CREATE INDEX IF NOT EXISTS idx_faq_performance_logs_openai_status ON public.faq_performance_logs(openai_status);
CREATE INDEX IF NOT EXISTS idx_faq_performance_logs_gemini_status ON public.faq_performance_logs(gemini_status);
CREATE INDEX IF NOT EXISTS idx_faq_performance_logs_perplexity_status ON public.faq_performance_logs(perplexity_status);
CREATE INDEX IF NOT EXISTS idx_faq_performance_logs_claude_status ON public.faq_performance_logs(claude_status);

-- Step 10: Add comment explaining the new structure
COMMENT ON TABLE public.faq_performance_logs IS 'Restructured to support individual LLM response tracking. Each test can now store responses from multiple LLMs simultaneously.';

-- Step 11: Create a function to migrate existing data (optional - for backward compatibility)
CREATE OR REPLACE FUNCTION migrate_existing_faq_performance_data()
RETURNS void AS $$
BEGIN
    -- Migrate existing single-provider data to new structure
    UPDATE public.faq_performance_logs 
    SET 
        openai_response = CASE WHEN ai_provider = 'openai' THEN ai_response ELSE NULL END,
        gemini_response = CASE WHEN ai_provider = 'gemini' THEN ai_response ELSE NULL END,
        perplexity_response = CASE WHEN ai_provider = 'perplexity' THEN ai_response ELSE NULL END,
        claude_response = CASE WHEN ai_provider = 'claude' THEN ai_response ELSE NULL END,
        
        openai_accuracy_score = CASE WHEN ai_provider = 'openai' THEN accuracy_score ELSE NULL END,
        gemini_accuracy_score = CASE WHEN ai_provider = 'gemini' THEN accuracy_score ELSE NULL END,
        perplexity_accuracy_score = CASE WHEN ai_provider = 'perplexity' THEN accuracy_score ELSE NULL END,
        claude_accuracy_score = CASE WHEN ai_provider = 'claude' THEN accuracy_score ELSE NULL END,
        
        openai_cost_usd = CASE WHEN ai_provider = 'openai' THEN cost_usd ELSE NULL END,
        gemini_cost_usd = CASE WHEN ai_provider = 'gemini' THEN cost_usd ELSE NULL END,
        perplexity_cost_usd = CASE WHEN ai_provider = 'perplexity' THEN cost_usd ELSE NULL END,
        claude_cost_usd = CASE WHEN ai_provider = 'claude' THEN cost_usd ELSE NULL END,
        
        openai_token_usage = CASE WHEN ai_provider = 'openai' THEN token_usage ELSE NULL END,
        gemini_token_usage = CASE WHEN ai_provider = 'gemini' THEN token_usage ELSE NULL END,
        perplexity_token_usage = CASE WHEN ai_provider = 'perplexity' THEN token_usage ELSE NULL END,
        claude_token_usage = CASE WHEN ai_provider = 'claude' THEN token_usage ELSE NULL END,
        
        openai_response_time_ms = CASE WHEN ai_provider = 'openai' THEN response_time_ms ELSE NULL END,
        gemini_response_time_ms = CASE WHEN ai_provider = 'gemini' THEN response_time_ms ELSE NULL END,
        perplexity_response_time_ms = CASE WHEN ai_provider = 'perplexity' THEN response_time_ms ELSE NULL END,
        claude_response_time_ms = CASE WHEN ai_provider = 'claude' THEN response_time_ms ELSE NULL END,
        
        openai_status = CASE WHEN ai_provider = 'openai' THEN status ELSE 'pending' END,
        gemini_status = CASE WHEN ai_provider = 'gemini' THEN status ELSE 'pending' END,
        perplexity_status = CASE WHEN ai_provider = 'perplexity' THEN status ELSE 'pending' END,
        claude_status = CASE WHEN ai_provider = 'claude' THEN status ELSE 'pending' END,
        
        openai_error_message = CASE WHEN ai_provider = 'openai' THEN error_message ELSE NULL END,
        gemini_error_message = CASE WHEN ai_provider = 'gemini' THEN error_message ELSE NULL END,
        perplexity_error_message = CASE WHEN ai_provider = 'perplexity' THEN error_message ELSE NULL END,
        claude_error_message = CASE WHEN ai_provider = 'claude' THEN error_message ELSE NULL END,
        
        tested_llms = ARRAY[ai_provider],
        test_month = DATE(test_date)
    WHERE ai_provider IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 12: Run the migration function
SELECT migrate_existing_faq_performance_data();

-- Step 13: Drop the migration function (cleanup)
DROP FUNCTION migrate_existing_faq_performance_data(); 