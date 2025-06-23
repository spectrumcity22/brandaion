-- Remove product_id column from client_product_persona table
-- Since personas are no longer related to products

-- Drop the product_id column
ALTER TABLE client_product_persona 
DROP COLUMN IF EXISTS product_id;

-- Add comment to document the change
COMMENT ON TABLE client_product_persona IS 'Updated to remove product_id column - personas are now completely independent entities'; 