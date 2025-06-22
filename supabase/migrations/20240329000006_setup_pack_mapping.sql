-- Set up pack field mapping for static backend names

-- Step 1: Update existing packages to map to pack1-pack4
UPDATE public.packages 
SET pack = CASE tier
    WHEN 'Startup' THEN 'pack1'
    WHEN 'Growth' THEN 'pack2'
    WHEN 'Pro' THEN 'pack3'
    WHEN 'Enterprise' THEN 'pack4'
    ELSE NULL
END
WHERE tier IN ('Startup', 'Growth', 'Pro', 'Enterprise');

-- Step 2: Drop the existing function first
DROP FUNCTION IF EXISTS get_package_limits(VARCHAR);

-- Step 3: Create the function with new parameter name
CREATE OR REPLACE FUNCTION get_package_limits(pack_name VARCHAR)
RETURNS TABLE(questions_limit INTEGER, llms_limit INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.monthly_questions_limit,
        p.monthly_llms_limit
    FROM public.packages p
    WHERE p.pack = pack_name;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Add constraint for pack field
ALTER TABLE public.packages 
ADD CONSTRAINT packages_pack_check 
CHECK (pack IN ('pack1', 'pack2', 'pack3', 'pack4'));

-- Step 5: Add comment explaining the pack field
COMMENT ON COLUMN public.packages.pack IS 'Static backend identifier (pack1-pack4) that never changes, allowing tier names to be updated without code changes';

-- Step 6: Test the function
-- This will show the mapping is working
SELECT 
    tier as display_name,
    pack as backend_name,
    monthly_questions_limit,
    monthly_llms_limit,
    monthly_price_cents
FROM public.packages 
WHERE pack IS NOT NULL
ORDER BY pack; 