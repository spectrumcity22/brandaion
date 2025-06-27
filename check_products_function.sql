-- Check current products function and trigger
-- This will show us what needs to be updated to match the brand JSON-LD pattern

-- Check if there's a function for products
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%product%' 
OR routine_name LIKE '%schema%'
OR routine_name LIKE '%json%';

-- Check if there's a trigger on the products table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND event_object_table = 'products';

-- Check the products table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'products'
ORDER BY ordinal_position;

-- Check if there are any existing functions that might be related
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_definition LIKE '%products%';

-- Check for any existing JSON-LD related functions
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_definition LIKE '%schema.org%'
OR routine_definition LIKE '%jsonb_build_object%'; 