-- Remove product requirement from client_configuration table
-- Since personas are now independent of products

-- Drop the foreign key constraint
ALTER TABLE client_configuration 
DROP CONSTRAINT IF EXISTS client_configuration_product_id_fkey;

-- Make product_id nullable and remove NOT NULL constraint
ALTER TABLE client_configuration 
ALTER COLUMN product_id DROP NOT NULL;

-- Add comment to document the change
COMMENT ON TABLE client_configuration IS 'Updated to remove product requirement - personas are now independent entities'; 