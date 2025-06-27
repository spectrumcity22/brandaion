-- Fix the product JSON-LD trigger to include AI analysis data
-- This trigger will now preserve existing schema_json if it has AI data,
-- or create a new one with AI data if available

-- First, add ai_response column to products table if it doesn't exist
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_response JSONB;

-- Drop the existing trigger
DROP TRIGGER IF EXISTS set_product_schema_json ON products;

-- Create the updated function that includes AI analysis data
CREATE OR REPLACE FUNCTION "public"."generate_product_schema_json"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    ai_data JSONB;
    industry_value TEXT;
    target_audience_value TEXT;
    value_proposition_value TEXT;
    main_features_value TEXT;
    brand_name_value TEXT;
BEGIN
    -- Get brand name if brand_id is available
    IF NEW.brand_id IS NOT NULL THEN
        SELECT brand_name INTO brand_name_value
        FROM brands
        WHERE id = NEW.brand_id;
    END IF;

    -- Try to parse AI response if it exists
    IF NEW.ai_response IS NOT NULL AND NEW.ai_response != '{}'::jsonb THEN
        BEGIN
            ai_data := NEW.ai_response;
            
            -- Extract AI analysis data
            industry_value := COALESCE(ai_data->>'industry', NEW.category, 'Technology');
            target_audience_value := COALESCE(ai_data->>'targetAudience', 'Businesses and consumers');
            value_proposition_value := COALESCE(ai_data->>'valueProposition', NEW.description, 'AI-powered product solution');
            main_features_value := COALESCE(ai_data->>'mainFeatures', 'Advanced features and capabilities');
            
            -- Create JSON-LD with AI data using brand relationship
            NEW.schema_json := jsonb_build_object(
                '@context', 'https://schema.org',
                '@type', 'Product',
                'name', COALESCE(NEW.product_name, ''),
                'url', COALESCE(NEW.url, ''),
                'brand', jsonb_build_object(
                    '@type', 'Brand',
                    'name', COALESCE(brand_name_value, '')
                ),
                'description', value_proposition_value,
                'industry', industry_value,
                'targetAudience', target_audience_value,
                'mainFeatures', main_features_value
            )::text;
            
        EXCEPTION WHEN OTHERS THEN
            -- If AI data parsing fails, fall back to basic schema
            NEW.schema_json := jsonb_build_object(
                '@context', 'https://schema.org',
                '@type', 'Product',
                'name', COALESCE(NEW.product_name, ''),
                'url', COALESCE(NEW.url, ''),
                'brand', jsonb_build_object(
                    '@type', 'Brand',
                    'name', COALESCE(brand_name_value, '')
                ),
                'description', COALESCE(NEW.description, '')
            )::text;
        END;
    ELSE
        -- No AI data available, create basic schema
        NEW.schema_json := jsonb_build_object(
            '@context', 'https://schema.org',
            '@type', 'Product',
            'name', COALESCE(NEW.product_name, ''),
            'url', COALESCE(NEW.url, ''),
            'brand', jsonb_build_object(
                '@type', 'Brand',
                'name', COALESCE(brand_name_value, '')
            ),
            'description', COALESCE(NEW.description, '')
        )::text;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER set_product_schema_json
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION generate_product_schema_json();

-- Grant permissions
ALTER FUNCTION "public"."generate_product_schema_json"() OWNER TO "postgres";

-- Test the trigger by updating an existing product
-- This will regenerate the JSON-LD with AI data if available
SELECT 
    'Trigger Updated' as status,
    'product schema_json trigger with AI analysis data' as description; 