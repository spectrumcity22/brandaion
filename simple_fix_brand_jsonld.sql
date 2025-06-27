-- Simple fix for brand JSON-LD trigger
-- Just add AI data to the basic structure

-- First, drop the existing trigger
DROP TRIGGER IF EXISTS generate_brand_jsonld_object ON brands;

-- Create the simple function
CREATE OR REPLACE FUNCTION "public"."generate_brand_jsonld_object"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    ai_data JSONB;
BEGIN
    -- Start with basic schema
    NEW.brand_jsonld_object := jsonb_build_object(
        '@context', 'https://schema.org',
        '@type', 'Organization',
        'name', COALESCE(NEW.brand_name, ''),
        'url', COALESCE(NEW.brand_url, ''),
        'description', 'AI-powered brand optimization services'
    );
    
    -- Try to add AI data if it exists
    IF NEW.ai_response IS NOT NULL AND NEW.ai_response != '' THEN
        BEGIN
            ai_data := NEW.ai_response::jsonb;
            
            -- Add AI fields if they exist
            IF ai_data->>'valueProposition' IS NOT NULL THEN
                NEW.brand_jsonld_object := NEW.brand_jsonld_object || jsonb_build_object(
                    'description', ai_data->>'valueProposition'
                );
            END IF;
            
            IF ai_data->>'industry' IS NOT NULL THEN
                NEW.brand_jsonld_object := NEW.brand_jsonld_object || jsonb_build_object(
                    'industry', ai_data->>'industry'
                );
            END IF;
            
            IF ai_data->>'targetAudience' IS NOT NULL THEN
                NEW.brand_jsonld_object := NEW.brand_jsonld_object || jsonb_build_object(
                    'additionalProperty', jsonb_build_array(
                        jsonb_build_object(
                            '@type', 'PropertyValue',
                            'name', 'Target Audience',
                            'value', ai_data->>'targetAudience'
                        )
                    )
                );
            END IF;
            
            IF ai_data->>'mainServices' IS NOT NULL THEN
                NEW.brand_jsonld_object := NEW.brand_jsonld_object || jsonb_build_object(
                    'hasOfferCatalog', jsonb_build_object(
                        '@type', 'OfferCatalog',
                        'name', COALESCE(NEW.brand_name, '') || ' Services',
                        'itemListElement', jsonb_build_array(
                            jsonb_build_object(
                                '@type', 'Offer',
                                'itemOffered', jsonb_build_object(
                                    '@type', 'Service',
                                    'name', ai_data->>'mainServices'
                                )
                            )
                        )
                    )
                );
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            -- If AI data parsing fails, just keep the basic schema
            NULL;
        END;
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
    'Simple Fix Applied' as status,
    'Basic structure with AI data added when available' as description; 