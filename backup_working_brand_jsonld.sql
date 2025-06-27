-- BACKUP of the working version with AI response
-- This is the version that was working with AI data

-- First, drop the existing trigger
DROP TRIGGER IF EXISTS generate_brand_jsonld_object ON brands;

-- Create the backup function
CREATE OR REPLACE FUNCTION "public"."generate_brand_jsonld_object"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    ai_data JSONB;
    industry_value TEXT;
    target_audience_value TEXT;
    value_proposition_value TEXT;
    main_services_value TEXT;
BEGIN
    -- Try to parse AI response if it exists
    IF NEW.ai_response IS NOT NULL AND NEW.ai_response != '' THEN
        BEGIN
            ai_data := NEW.ai_response::jsonb;
            
            -- Extract AI analysis data
            industry_value := COALESCE(ai_data->>'industry', 'Technology');
            target_audience_value := COALESCE(ai_data->>'targetAudience', 'Businesses and brands');
            value_proposition_value := COALESCE(ai_data->>'valueProposition', 'AI-powered brand optimization');
            main_services_value := COALESCE(ai_data->>'mainServices', 'Brand Optimization');
            
            -- Create simplified JSON-LD with AI data (no duplication)
            NEW.brand_jsonld_object := jsonb_build_object(
                '@context', 'https://schema.org',
                '@type', 'Brand',
                'name', COALESCE(NEW.brand_name, ''),
                'url', COALESCE(NEW.brand_url, ''),
                'description', value_proposition_value,
                'industry', industry_value,
                'targetAudience', target_audience_value,
                'mainServices', main_services_value,
                'provider', jsonb_build_object(
                    '@type', 'Organization',
                    'name', COALESCE(NEW.organisation_name, '')
                )
            );
            
        EXCEPTION WHEN OTHERS THEN
            -- If AI data parsing fails, fall back to basic schema
            NEW.brand_jsonld_object := jsonb_build_object(
                '@context', 'https://schema.org',
                '@type', 'Brand',
                'name', COALESCE(NEW.brand_name, ''),
                'url', COALESCE(NEW.brand_url, ''),
                'provider', jsonb_build_object(
                    '@type', 'Organization',
                    'name', COALESCE(NEW.organisation_name, '')
                )
            );
        END;
    ELSE
        -- No AI data available, create basic schema
        NEW.brand_jsonld_object := jsonb_build_object(
            '@context', 'https://schema.org',
            '@type', 'Brand',
            'name', COALESCE(NEW.brand_name, ''),
            'url', COALESCE(NEW.brand_url, ''),
            'provider', jsonb_build_object(
                '@type', 'Organization',
                'name', COALESCE(NEW.organisation_name, '')
            )
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
    'BACKUP CREATED' as status,
    'This is the working version with AI data' as description; 