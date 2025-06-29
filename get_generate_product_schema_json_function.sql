-- Get the generate_product_schema_json function definition using pg_get_functiondef
-- This should show us where the wrong product name "FAQ Pairs" is being set

SELECT 
  'generate_product_schema_json Function Definition' as check_type,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'generate_product_schema_json'
  AND n.nspname = 'public';

-- Alternative approach using information_schema with different method
SELECT 
  'generate_product_schema_json Function Definition (Alt)' as check_type,
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'generate_product_schema_json'
  AND routine_schema = 'public'
  AND routine_definition IS NOT NULL;

-- If the above doesn't work, try a broader search
SELECT 
  'All functions with generate_product' as check_type,
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_name ILIKE '%generate_product%'
  AND routine_schema = 'public';

-- Also check if the function might be in a different schema
SELECT 
  'All schemas with generate_product_schema_json' as check_type,
  routine_schema,
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name ILIKE '%generate_product_schema_json%';

-- Also get the populate_product_brand_name function
SELECT 
  'populate_product_brand_name Function Definition' as check_type,
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'populate_product_brand_name'
  AND routine_schema = 'public'; 