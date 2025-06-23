-- Remove product relationship from client_product_persona table
-- Since personas are no longer related to products

-- Drop the foreign key constraint
ALTER TABLE client_product_persona 
DROP CONSTRAINT IF EXISTS client_product_persona_product_id_fkey;

-- Make product_id nullable and remove NOT NULL constraint
ALTER TABLE client_product_persona 
ALTER COLUMN product_id DROP NOT NULL;

-- Add comment to document the change
COMMENT ON TABLE client_product_persona IS 'Updated to remove product relationship - personas are now independent'; 