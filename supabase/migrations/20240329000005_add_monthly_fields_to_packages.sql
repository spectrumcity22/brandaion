-- Add monthly performance testing fields to existing packages table

-- Step 1: Add new columns for monthly performance testing
ALTER TABLE public.packages 
ADD COLUMN IF NOT EXISTS monthly_questions_limit INTEGER,
ADD COLUMN IF NOT EXISTS monthly_llms_limit INTEGER,
ADD COLUMN IF NOT EXISTS monthly_price_cents INTEGER,
ADD COLUMN IF NOT EXISTS monthly_description TEXT;

-- Step 2: Update existing packages with monthly performance limits
UPDATE public.packages 
SET 
    monthly_questions_limit = CASE tier
        WHEN 'Startup' THEN 5
        WHEN 'Growth' THEN 10
        WHEN 'Pro' THEN 15
        WHEN 'Enterprise' THEN 20
        ELSE 5
    END,
    monthly_llms_limit = CASE tier
        WHEN 'Startup' THEN 1
        WHEN 'Growth' THEN 2
        WHEN 'Pro' THEN 3
        WHEN 'Enterprise' THEN 4
        ELSE 1
    END,
    monthly_price_cents = CASE tier
        WHEN 'Startup' THEN 1000  -- $10.00
        WHEN 'Growth' THEN 2000   -- $20.00
        WHEN 'Pro' THEN 3000      -- $30.00
        WHEN 'Enterprise' THEN 4000 -- $40.00
        ELSE 1000
    END,
    monthly_description = CASE tier
        WHEN 'Startup' THEN 'Monitor 5 key questions with 1 AI provider monthly. Perfect for startups getting started with AI performance tracking.'
        WHEN 'Growth' THEN 'Monitor 10 questions with 2 AI providers monthly. Ideal for growing businesses wanting comprehensive AI performance insights.'
        WHEN 'Pro' THEN 'Monitor 15 questions with 3 AI providers monthly. Perfect for established businesses requiring detailed AI performance analysis.'
        WHEN 'Enterprise' THEN 'Monitor 20 questions with all 4 AI providers monthly. Comprehensive AI performance monitoring for enterprise-level insights.'
        ELSE 'Basic monthly performance monitoring'
    END
WHERE tier IN ('Startup', 'Growth', 'Pro', 'Enterprise');

-- Step 3: Add constraints for the new fields
ALTER TABLE public.packages 
ADD CONSTRAINT packages_monthly_questions_limit_check 
CHECK (monthly_questions_limit IN (5, 10, 15, 20));

ALTER TABLE public.packages 
ADD CONSTRAINT packages_monthly_llms_limit_check 
CHECK (monthly_llms_limit IN (1, 2, 3, 4));

-- Step 4: Update the get_package_limits function to use the packages table
CREATE OR REPLACE FUNCTION get_package_limits(package_tier VARCHAR)
RETURNS TABLE(questions_limit INTEGER, llms_limit INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.monthly_questions_limit,
        p.monthly_llms_limit
    FROM public.packages p
    WHERE p.tier = package_tier;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Add comment explaining the new fields
COMMENT ON COLUMN public.packages.monthly_questions_limit IS 'Number of questions user can select for monthly performance monitoring';
COMMENT ON COLUMN public.packages.monthly_llms_limit IS 'Number of LLM providers user can select for monthly performance testing';
COMMENT ON COLUMN public.packages.monthly_price_cents IS 'Monthly price for performance monitoring in cents';
COMMENT ON COLUMN public.packages.monthly_description IS 'Description of monthly performance monitoring features';

-- Step 6: Update table comment
COMMENT ON TABLE public.packages IS 'Packages for both FAQ generation and monthly performance monitoring'; 