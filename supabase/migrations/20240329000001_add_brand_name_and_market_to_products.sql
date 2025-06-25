-- Add brand_name column to products table
ALTER TABLE "public"."products" 
ADD COLUMN IF NOT EXISTS "brand_name" "text";

-- Create a function to populate brand_name from brand_id
CREATE OR REPLACE FUNCTION "public"."populate_product_brand_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- If brand_id is provided, populate brand_name from brands table
    IF NEW.brand_id IS NOT NULL THEN
        SELECT brand_name INTO NEW.brand_name
        FROM brands
        WHERE id = NEW.brand_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to automatically populate brand_name when brand_id is set
DROP TRIGGER IF EXISTS "tr_populate_product_brand_name" ON "public"."products";
CREATE TRIGGER "tr_populate_product_brand_name"
    BEFORE INSERT OR UPDATE ON "public"."products"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."populate_product_brand_name"();

-- Backfill existing products with brand_name from brand_id
UPDATE "public"."products" 
SET brand_name = (
    SELECT brand_name 
    FROM brands 
    WHERE brands.id = products.brand_id
)
WHERE brand_id IS NOT NULL AND brand_name IS NULL; 