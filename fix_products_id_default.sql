-- Fix the products table id column to have a default value
-- This will allow new products to be inserted without explicitly providing an ID

-- Add default value to the id column
ALTER TABLE public.products 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Verify the change
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'products' 
  AND column_name = 'id'; 