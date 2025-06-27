-- Clean brand JSON-LD trigger with correct field order
DROP TRIGGER IF EXISTS generate_brand_jsonld_object ON brands;

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
    IF NEW.ai_response IS NOT NULL AND NEW.ai_response != '' THEN
        BEGIN
            ai_data := NEW.ai_response::jsonb;
            
            industry_value := COALESCE(ai_data->>'industry', 'Technology');
            target_audience_value := COALESCE(ai_data->>'targetAudience', 'Businesses and brands');
            value_proposition_value := COALESCE(ai_data->>'valueProposition', 'AI-powered brand optimization');
            main_services_value := COALESCE(ai_data->>'mainServices', 'Brand Optimization');
            
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
                'mainServices', main_services_value
            );
            
        EXCEPTION WHEN OTHERS THEN
            NEW.brand_jsonld_object := jsonb_build_object(
                '@context', 'https://schema.org',
                '@type', 'Brand',
                'name', COALESCE(NEW.brand_name, ''),
                'url', COALESCE(NEW.brand_url, ''),
                'parentOrganization', jsonb_build_object(
                    '@type', 'Organization',
                    'name', COALESCE(NEW.organisation_name, '')
                )
            );
        END;
    ELSE
        NEW.brand_jsonld_object := jsonb_build_object(
            '@context', 'https://schema.org',
            '@type', 'Brand',
            'name', COALESCE(NEW.brand_name, ''),
            'url', COALESCE(NEW.brand_url, ''),
            'parentOrganization', jsonb_build_object(
                '@type', 'Organization',
                'name', COALESCE(NEW.organisation_name, '')
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER generate_brand_jsonld_object
    BEFORE INSERT OR UPDATE ON brands
    FOR EACH ROW
    EXECUTE FUNCTION generate_brand_jsonld_object();

ALTER FUNCTION "public"."generate_brand_jsonld_object"() OWNER TO "postgres"; 