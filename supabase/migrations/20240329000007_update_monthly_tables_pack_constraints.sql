-- Update monthly selection tables to use pack1-pack4 constraints

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

-- Step 4: Add comments explaining the pack system
COMMENT ON TABLE public.user_monthly_questions IS 'Tracks which questions users have selected for monthly performance monitoring using pack1-pack4 system';
COMMENT ON TABLE public.user_monthly_llms IS 'Tracks which LLMs users have selected for monthly performance testing using pack1-pack4 system';
COMMENT ON TABLE public.user_monthly_schedule IS 'Tracks user monthly testing schedule using pack1-pack4 system'; 