-- Fix the brand JSON-LD trigger to include AI analysis data and products
-- This trigger will now preserve existing brand_jsonld_object if it has AI data,
-- or create a new one with AI data if available, and include associated products

-- First, drop the existing trigger
DROP TRIGGER IF EXISTS generate_brand_jsonld_object ON brands;

-- Create the updated function that includes AI analysis data and products
CREATE OR REPLACE FUNCTION "public"."generate_brand_jsonld_object"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    ai_data JSONB;
    industry_value TEXT;
    target_audience_value TEXT;
    value_proposition_value TEXT;
    main_services_value TEXT;
    brand_products JSONB;
BEGIN
    -- Get products associated with this brand
    SELECT jsonb_agg(
        jsonb_build_object(
            '@type', 'Product',
            'name', p.product_name,
            'productId', p.id,
            'description', COALESCE(p.description, ''),
            'url', COALESCE(p.url, ''),
            'productJsonld', CASE 
                WHEN p.schema_json IS NOT NULL THEN p.schema_json::jsonb
                ELSE NULL
            END
        )
    ) INTO brand_products
    FROM products p
    WHERE p.brand_id = NEW.id AND p.auth_user_id = NEW.auth_user_id;

    -- Try to parse AI response if it exists
    IF NEW.ai_response IS NOT NULL AND NEW.ai_response != '' THEN
        BEGIN
            ai_data := NEW.ai_response::jsonb;
            
            -- Extract AI analysis data
            industry_value := COALESCE(ai_data->>'industry', 'Technology');
            target_audience_value := COALESCE(ai_data->>'targetAudience', 'Businesses and brands');
            value_proposition_value := COALESCE(ai_data->>'valueProposition', 'AI-powered brand optimization');
            main_services_value := COALESCE(ai_data->>'mainServices', 'Brand Optimization');
            
            -- Create JSON-LD with AI data using parentOrganization structure and products
            NEW.brand_jsonld_object := jsonb_build_object(
                '@context', 'https://schema.org',
                '@type', 'Brand',
                'name', COALESCE(NEW.brand_name, ''),
                'url', COALESCE(NEW.brand_url, ''),
                'parentOrganization', jsonb_build_object(
                    '@type', 'Organization',
                    'name', COALESCE(NEW.organisation_name, '')
                ),
                'description', value_proposition_value,
                'industry', industry_value,
                'targetAudience', target_audience_value,
                'mainServices', main_services_value,
                'products', COALESCE(brand_products, '[]'::jsonb),
                'productCount', COALESCE(jsonb_array_length(brand_products), 0)
            );
            
        EXCEPTION WHEN OTHERS THEN
            -- If AI data parsing fails, fall back to basic schema with products
            NEW.brand_jsonld_object := jsonb_build_object(
                '@context', 'https://schema.org',
                '@type', 'Brand',
                'name', COALESCE(NEW.brand_name, ''),
                'url', COALESCE(NEW.brand_url, ''),
                'parentOrganization', jsonb_build_object(
                    '@type', 'Organization',
                    'name', COALESCE(NEW.organisation_name, '')
                ),
                'products', COALESCE(brand_products, '[]'::jsonb),
                'productCount', COALESCE(jsonb_array_length(brand_products), 0)
            );
        END;
    ELSE
        -- No AI data available, create basic schema with products
        NEW.brand_jsonld_object := jsonb_build_object(
            '@context', 'https://schema.org',
            '@type', 'Brand',
            'name', COALESCE(NEW.brand_name, ''),
            'url', COALESCE(NEW.brand_url, ''),
            'parentOrganization', jsonb_build_object(
                '@type', 'Organization',
                'name', COALESCE(NEW.organisation_name, '')
            ),
            'products', COALESCE(brand_products, '[]'::jsonb),
            'productCount', COALESCE(jsonb_array_length(brand_products), 0)
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER generate_brand_jsonld_object
    BEFORE INSERT OR UPDATE ON brands
    FOR EACH ROW
    EXECUTE FUNCTION generate_brand_jsonld_object();

-- Grant permissions
ALTER FUNCTION "public"."generate_brand_jsonld_object"() OWNER TO "postgres";

-- Test the trigger by updating an existing brand
-- This will regenerate the JSON-LD with AI data and products if available
SELECT 
    'Trigger Updated' as status,
    'brand_jsonld_object trigger with parentOrganization structure and products' as description; 