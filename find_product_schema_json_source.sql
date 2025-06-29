-- Find the source of product schema_json and the wrong product name
-- This will help us trace where "FAQ Pairs" is coming from

-- 1. Check the products table structure and data
SELECT 
  'Products Table Check' as check_type,
  id,
  product_name,
  schema_json,
  organisation_id,
  brand_id,
  auth_user_id,
  created_at,
  updated_at
FROM products 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
ORDER BY created_at DESC;

-- 2. Check client_configuration table for product data
SELECT 
  'Client Configuration Check' as check_type,
  id,
  auth_user_id,
  product_name,
  schema_json,
  product_id,
  created_at,
  updated_at
FROM client_configuration 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
ORDER BY created_at DESC;

-- 3. Check what functions/triggers might be populating product data
SELECT 
  'Functions that might populate product data' as check_type,
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%product%' 
  AND routine_definition ILIKE '%schema_json%'
  AND routine_schema = 'public';

-- 4. Check triggers on products table
SELECT 
  'Triggers on products table' as check_type,
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'products'
  AND trigger_schema = 'public';

-- 5. Check if there are any functions that update product schema_json
SELECT 
  'Functions that update product schema_json' as check_type,
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%UPDATE%products%'
  AND routine_definition ILIKE '%schema_json%'
  AND routine_schema = 'public';

-- Find the source of the wrong product name "FAQ Pairs" in the generate_product_schema_json function
-- Based on actual table structure and triggers

-- 1. Check the generate_product_schema_json function that's triggered on INSERT/UPDATE
SELECT 
  'generate_product_schema_json Function' as check_type,
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'generate_product_schema_json'
  AND routine_schema = 'public';

-- 2. Check the populate_product_brand_name function as well
SELECT 
  'populate_product_brand_name Function' as check_type,
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'populate_product_brand_name'
  AND routine_schema = 'public';

-- 3. Check current products data for the specific user
SELECT 
  'Current Products Data' as check_type,
  id,
  product_name,
  description,
  category,
  keywords,
  url,
  schema_json,
  auth_user_id,
  organisation_id,
  brand_id,
  brand_name,
  industry,
  subcategory,
  inserted_at
FROM products 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
ORDER BY inserted_at DESC;

-- 4. Check if there are any other functions that might be setting product names
SELECT 
  'Functions with FAQ or product name logic' as check_type,
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%FAQ%'
  OR routine_definition ILIKE '%product_name%'
  OR routine_definition ILIKE '%name%FAQ%'
  AND routine_schema = 'public';

-- 5. Check triggers on products table
SELECT 
  'Products Table Triggers' as check_type,
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'products'
  AND trigger_schema = 'public'; 