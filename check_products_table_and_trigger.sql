-- Check the products table structure and default values
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns 
WHERE table_name = 'products'
ORDER BY ordinal_position;

-- Check if the id column has a default value
SELECT 
    column_name,
    column_default
FROM information_schema.columns 
WHERE table_name = 'products' 
  AND column_name = 'id';

-- Check the trigger on the products table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'products';

-- Check the generate_product_schema_json function definition
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'generate_product_schema_json';

-- Check if there are any other functions that might be interfering
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosrc ILIKE '%products%'
  AND p.prosrc ILIKE '%insert%'
ORDER BY p.proname; 