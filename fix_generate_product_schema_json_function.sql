-- Update the generate_product_schema_json function to use [productname]-product.jsonld naming
-- This ensures unique filenames across thousands of products from multiple clients

CREATE OR REPLACE FUNCTION generate_product_schema_json()
RETURNS TRIGGER AS $$
DECLARE
    ai_data JSONB;
    analysis_text TEXT;
    ai_defined_industry TEXT;
    target_audience_value TEXT;
    value_proposition_value TEXT;
    main_features_value TEXT;
    competitors_value TEXT;
BEGIN
    -- Parse AI response if it exists
    IF NEW.ai_response IS NOT NULL AND NEW.ai_response != '' THEN
        BEGIN
            ai_data := NEW.ai_response::jsonb;
            
            -- Check if we have the analysis field
            IF ai_data ? 'analysis' THEN
                analysis_text := ai_data->>'analysis';
                
                -- Parse the analysis text format: "industry: value\ntarget_audience: value\n..."
                ai_defined_industry := COALESCE(
                    (SELECT substring(analysis_text from 'industry:\s*([^\n]+)')), ''
                );
                target_audience_value := COALESCE(
                    (SELECT substring(analysis_text from 'target_audience:\s*([^\n]+)')), ''
                );
                value_proposition_value := COALESCE(
                    (SELECT substring(analysis_text from 'value_proposition:\s*([^\n]+)')), ''
                );
                main_features_value := COALESCE(
                    (SELECT substring(analysis_text from 'main_features:\s*([^\n]+)')), ''
                );
                competitors_value := COALESCE(
                    (SELECT substring(analysis_text from 'competitors:\s*([^\n]+)')), ''
                );
            ELSE
                -- Fall back to direct field access
                ai_defined_industry := COALESCE(ai_data->>'industry', '');
                target_audience_value := COALESCE(ai_data->>'targetAudience', '');
                value_proposition_value := COALESCE(ai_data->>'valueProposition', '');
                main_features_value := COALESCE(ai_data->>'mainFeatures', '');
                competitors_value := COALESCE(ai_data->>'competitors', '');
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- If parsing fails, set empty values
            ai_defined_industry := '';
            target_audience_value := '';
            value_proposition_value := '';
            main_features_value := '';
            competitors_value := '';
        END;
    ELSE
        -- No AI data
        ai_defined_industry := '';
        target_audience_value := '';
        value_proposition_value := '';
        main_features_value := '';
        competitors_value := '';
    END IF;

    -- Generate schema with [productname]-product.jsonld naming convention
    NEW.schema_json :=
        '{' || chr(10) ||
        '  "@context": "https://schema.org",' || chr(10) ||
        '  "@type": "Product",' || chr(10) ||
        '  "name": "' || COALESCE(NEW.product_name, '') || '-product",' || chr(10) ||
        '  "description": "' || COALESCE(NEW.description, '') || '",' || chr(10) ||
        '  "keywords": "' || COALESCE(NEW.keywords, '') || '",' || chr(10) ||
        '  "url": "' || COALESCE(NEW.url, '') || '",' || chr(10) ||
        '  "organisation": {' || chr(10) ||
        '    "@type": "Organization",' || chr(10) ||
        '    "name": "' || COALESCE(NEW.organisation, '') || '"' || chr(10) ||
        '  },' || chr(10) ||
        '  "user_defined_category": "' || COALESCE(NEW.category, '') || '",' || chr(10) ||
        '  "industry": "' || COALESCE(NEW.industry, '') || '",' || chr(10) ||
        '  "subcategory": "' || COALESCE(NEW.subcategory, '') || '",' || chr(10) ||
        '  "ai_defined_industry": "' || ai_defined_industry || '",' || chr(10) ||
        '  "targetAudience": "' || target_audience_value || '",' || chr(10) ||
        '  "valueProposition": "' || value_proposition_value || '",' || chr(10) ||
        '  "mainFeatures": "' || main_features_value || '",' || chr(10) ||
        '  "competitors": "' || competitors_value || '"' || chr(10) ||
        '}';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql; 