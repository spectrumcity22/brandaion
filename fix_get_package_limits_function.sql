-- Fix the get_package_limits function to work with the frontend
-- The frontend calls this function with package_tier parameter, but recent migrations changed it to pack_name

-- Drop the existing function first
DROP FUNCTION IF EXISTS get_package_limits(VARCHAR);

-- Create the function with the correct parameter name that the frontend expects
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

-- Add comment explaining the function
COMMENT ON FUNCTION get_package_limits(VARCHAR) IS 'Returns the question and LLM limits for package tiers: pack1(5q,1llm), pack2(10q,2llm), pack3(15q,3llm), pack4(20q,4llm)';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_package_limits(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_package_limits(VARCHAR) TO service_role; 