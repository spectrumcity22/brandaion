-- Debug brand JSON-LD trigger - to see what data is actually being received
-- This will help us understand why the AI data isn't being parsed correctly

-- First, drop the existing trigger
DROP TRIGGER IF EXISTS generate_brand_jsonld_object ON brands;

-- Create the debug function
CREATE OR REPLACE FUNCTION "public"."generate_brand_jsonld_object"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    ai_data JSONB;
    services_array JSONB;
    debug_info TEXT;
BEGIN
    -- Log the raw AI response for debugging
    debug_info := 'Raw ai_response: ' || COALESCE(NEW.ai_response, 'NULL');
    RAISE NOTICE '%', debug_info;
    
    -- Try to parse AI response if it exists
    IF NEW.ai_response IS NOT NULL AND NEW.ai_response != '' THEN
        BEGIN
            ai_data := NEW.ai_response::jsonb;
            
            -- Log the parsed JSON for debugging
            debug_info := 'Parsed ai_data: ' || ai_data::text;
            RAISE NOTICE '%', debug_info;
            
            -- Log individual fields
            debug_info := 'industry: ' || COALESCE(ai_data->>'industry', 'NULL');
            RAISE NOTICE '%', debug_info;
            debug_info := 'targetAudience: ' || COALESCE(ai_data->>'targetAudience', 'NULL');
            RAISE NOTICE '%', debug_info;
            debug_info := 'valueProposition: ' || COALESCE(ai_data->>'valueProposition', 'NULL');
            RAISE NOTICE '%', debug_info;
            debug_info := 'mainServices: ' || COALESCE(ai_data->>'mainServices', 'NULL');
            RAISE NOTICE '%', debug_info;
            
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
            
            debug_info := 'Generated JSON-LD: ' || NEW.brand_jsonld_object::text;
            RAISE NOTICE '%', debug_info;
            
        EXCEPTION WHEN OTHERS THEN
            -- If AI data parsing fails, log the error and fall back to basic schema
            debug_info := 'Error parsing AI data: ' || SQLERRM;
            RAISE NOTICE '%', debug_info;
            
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
        debug_info := 'No AI data available, creating basic schema';
        RAISE NOTICE '%', debug_info;
        
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
    'Debug Trigger Created' as status,
    'Check logs to see what data is being received' as description; 