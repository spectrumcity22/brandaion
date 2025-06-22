-- Update package tier names to pack1, pack2, pack3, pack4

-- Step 1: Update user_monthly_questions table constraints
ALTER TABLE public.user_monthly_questions 
DROP CONSTRAINT IF EXISTS user_monthly_questions_package_tier_check;

ALTER TABLE public.user_monthly_questions 
ADD CONSTRAINT user_monthly_questions_package_tier_check 
CHECK (package_tier IN ('pack1', 'pack2', 'pack3', 'pack4'));

-- Step 2: Update user_monthly_llms table constraints
ALTER TABLE public.user_monthly_llms 
DROP CONSTRAINT IF EXISTS user_monthly_llms_package_tier_check;

ALTER TABLE public.user_monthly_llms 
ADD CONSTRAINT user_monthly_llms_package_tier_check 
CHECK (package_tier IN ('pack1', 'pack2', 'pack3', 'pack4'));

-- Step 3: Update user_monthly_schedule table constraints
ALTER TABLE public.user_monthly_schedule 
DROP CONSTRAINT IF EXISTS user_monthly_schedule_package_tier_check;

ALTER TABLE public.user_monthly_schedule 
ADD CONSTRAINT user_monthly_schedule_package_tier_check 
CHECK (package_tier IN ('pack1', 'pack2', 'pack3', 'pack4'));

-- Step 4: Update the get_package_limits function
CREATE OR REPLACE FUNCTION get_package_limits(package_tier VARCHAR)
RETURNS TABLE(questions_limit INTEGER, llms_limit INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE package_tier
            WHEN 'pack1' THEN 5
            WHEN 'pack2' THEN 10
            WHEN 'pack3' THEN 15
            WHEN 'pack4' THEN 20
            ELSE 5
        END as questions_limit,
        CASE package_tier
            WHEN 'pack1' THEN 1
            WHEN 'pack2' THEN 2
            WHEN 'pack3' THEN 3
            WHEN 'pack4' THEN 4
            ELSE 1
        END as llms_limit;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Add comment explaining the package tiers
COMMENT ON FUNCTION get_package_limits(VARCHAR) IS 'Returns the question and LLM limits for package tiers: pack1(5q,1llm), pack2(10q,2llm), pack3(15q,3llm), pack4(20q,4llm)'; 