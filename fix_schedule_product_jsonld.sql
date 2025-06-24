-- Add missing product_jsonld_object column to schedule table
-- This is needed because the format_ai_request trigger expects this column

ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS product_jsonld_object text;

-- Update existing records to have a default value if needed
-- You can customize this based on your business logic
UPDATE schedules 
SET product_jsonld_object = '{}' 
WHERE product_jsonld_object IS NULL;

-- Make the column NOT NULL after setting default values
ALTER TABLE schedules 
ALTER COLUMN product_jsonld_object SET NOT NULL;

-- Add a comment to document the purpose
COMMENT ON COLUMN schedules.product_jsonld_object IS 'JSON-LD object for the product associated with this schedule'; 