-- Simplified brand JSON-LD trigger - NO DUPLICATION
-- This creates a clean, efficient schema.org structure using Organization type

-- First, drop the existing trigger
DROP TRIGGER IF EXISTS generate_brand_jsonld_object ON brands;

-- Create the simplified function
CREATE OR REPLACE FUNCTION "public"."generate_brand_jsonld_object"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    ai_data JSONB;
    services_array JSONB;
BEGIN
    -- Try to parse AI response if it exists
    IF NEW.ai_response IS NOT NULL AND NEW.ai_response != '' THEN
        BEGIN
            ai_data := NEW.ai_response::jsonb;
            
            -- Create services array from mainServices
            services_array := '[]'::jsonb;
            IF ai_data->>'mainServices' IS NOT NULL THEN
                SELECT jsonb_agg(
                    jsonb_build_object(
                        '@type', 'Offer',
                        'itemOffered', jsonb_build_object(
                            '@type', 'Service',
                            'name', trim(unnest(string_to_array(ai_data->>'mainServices', ',')))
                        )
                    )
                ) INTO services_array
                FROM unnest(string_to_array(ai_data->>'mainServices', ','));
            END IF;
            
            -- Create clean JSON-LD with AI data (Organization type for better schema.org compliance)
            NEW.brand_jsonld_object := jsonb_build_object(
                '@context', 'https://schema.org',
                '@type', 'Organization',
                'name', COALESCE(NEW.brand_name, ''),
                'url', COALESCE(NEW.brand_url, ''),
                'description', COALESCE(ai_data->>'valueProposition', 'AI-powered brand optimization'),
                'industry', COALESCE(ai_data->>'industry', 'Technology'),
                'additionalProperty', jsonb_build_array(
                    jsonb_build_object(
                        '@type', 'PropertyValue',
                        'name', 'Target Audience',
                        'value', COALESCE(ai_data->>'targetAudience', 'Businesses and brands')
                    )
                )
            );
            
            -- Add services catalog if services exist
            IF services_array != '[]'::jsonb THEN
                NEW.brand_jsonld_object := NEW.brand_jsonld_object || jsonb_build_object(
                    'hasOfferCatalog', jsonb_build_object(
                        '@type', 'OfferCatalog',
                        'name', COALESCE(NEW.brand_name, '') || ' Services',
                        'itemListElement', services_array
                    )
                );
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            -- If AI data parsing fails, fall back to basic schema
            NEW.brand_jsonld_object := jsonb_build_object(
                '@context', 'https://schema.org',
                '@type', 'Organization',
                'name', COALESCE(NEW.brand_name, ''),
                'url', COALESCE(NEW.brand_url, ''),
                'description', 'AI-powered brand optimization services'
            );
        END;
    ELSE
        -- No AI data available, create basic schema
        NEW.brand_jsonld_object := jsonb_build_object(
            '@context', 'https://schema.org',
            '@type', 'Organization',
            'name', COALESCE(NEW.brand_name, ''),
            'url', COALESCE(NEW.brand_url, ''),
            'description', 'AI-powered brand optimization services'
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

-- Test message
SELECT 
    'Simplified Trigger Created' as status,
    'Organization-based JSON-LD structure with services catalog' as description; 