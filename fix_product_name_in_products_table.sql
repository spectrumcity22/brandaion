-- Fix the wrong product name "FAQ Pairs" in the products table
-- This is the root cause of the wrong file naming in LLM discovery

-- 1. First, let's see what we currently have
SELECT 
  'Current Products with Wrong Name' as check_type,
  id,
  product_name,
  description,
  category,
  industry,
  subcategory,
  auth_user_id,
  inserted_at
FROM products 
WHERE product_name ILIKE '%FAQ%' 
  OR product_name ILIKE '%Pairs%'
  OR product_name = 'FAQ Pairs'
ORDER BY inserted_at DESC;

-- 2. Update the product name to something appropriate based on the description
UPDATE products 
SET 
  product_name = 'Brandaion Content Optimizer',
  updated_at = NOW()
WHERE product_name = 'FAQ Pairs' 
  AND auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f';

-- 3. Verify the fix
SELECT 
  'Products After Fix' as check_type,
  id,
  product_name,
  description,
  category,
  industry,
  subcategory,
  auth_user_id,
  updated_at
FROM products 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
ORDER BY updated_at DESC;

-- 4. The trigger will automatically regenerate the schema_json with the correct name
-- But we can also manually trigger it if needed
UPDATE products 
SET updated_at = NOW()
WHERE product_name = 'Brandaion Content Optimizer' 
  AND auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'; 