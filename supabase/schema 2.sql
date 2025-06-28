

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."backfill_auth_user_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  update invoices
  set auth_user_id = eu.id
  from auth.users au
  join end_users eu on eu.auth_user_id = au.id
  where invoices.user_email = au.email
    and invoices.id = new.id;
  return new;
end;
$$;


ALTER FUNCTION "public"."backfill_auth_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."basic_test"("user_id_param" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN 'Function working for user: ' || user_id_param;
END;
$$;


ALTER FUNCTION "public"."basic_test"("user_id_param" "uuid") OWNER TO "postgres";


CREATE PROCEDURE "public"."call_patch_auth_ids"()
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  response json;
BEGIN
  SELECT
    net.http_post(
      url := vault.get_secret('project_url')::TEXT || '/functions/v1/patch_auth_ids',
      headers := json_build_object(
        'Authorization', 'Bearer ' || vault.get_secret('service_role_key')::TEXT,
        'Content-Type', 'application/json'
      ),
      body := '{}'
    )
  INTO response;
END;
$$;


ALTER PROCEDURE "public"."call_patch_auth_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_user_subscription_status"("user_id_param" "uuid") RETURNS TABLE("subscription_status" "text", "can_continue_testing" boolean, "package_tier" "text", "next_test_date" "date", "has_active_subscription" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Return results directly from query
    RETURN QUERY
    SELECT 
        CASE 
            WHEN i.id IS NOT NULL THEN 'active'
            ELSE 'inactive'
        END::TEXT,
        (i.id IS NOT NULL)::BOOLEAN,
        i.package_tier,
        CURRENT_DATE,
        (i.id IS NOT NULL)::BOOLEAN
    FROM invoices i
    WHERE i.auth_user_id = user_id_param
      AND CURRENT_DATE >= i.billing_period_start::date 
      AND CURRENT_DATE <= i.billing_period_end::date
    ORDER BY i.paid_at DESC
    LIMIT 1;
    
    -- If no rows returned, return inactive
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            'inactive'::TEXT,
            false::BOOLEAN,
            null::TEXT,
            null::DATE,
            false::BOOLEAN;
    END IF;
END;
$$;


ALTER FUNCTION "public"."check_user_subscription_status"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."construct_answer_prompt"("faq_pair_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    prompt TEXT;
    request_data TEXT;
    questions_data TEXT;
BEGIN
    -- Get the FAQ pair data
    SELECT 
        ai_request_for_questions,
        ai_response_questions
    INTO request_data, questions_data
    FROM construct_faq_pairs
    WHERE id = faq_pair_id;

    -- Construct the prompt as text
    prompt := '{' ||
        '"batchNo": "' || request_data || '",' ||
        '"uniqueBatchId": "' || request_data || '",' ||
        '"faqCountInBatch": ' || request_data || ',' ||
        '"questions": ' || questions_data || ',' ||
        '"product persona": {' ||
            '"product": "AI Optimisation - FAQ Pairs",' ||
            '"coreValue": "Innovation",' ||
            '"toneOfVoice": "Friendly, approachable, conversational",' ||
            '"archetype": "The Creator (innovative, original)",' ||
            '"customerEmotion": "Inspired, motivated",' ||
            '"formality": "Balanced (professional but conversational, minimal slang/emoji)",' ||
            '"humorStyle": "Balanced (friendly, but humor used sparingly)",' ||
            '"languageComplexity": "Balanced (clear but includes some technical terms as needed)",' ||
            '"emotionallyExpressive": "Moderately expressive (balanced emotions with clear information)",' ||
            '"wordsToAvoid": "Slang or overly casual expressions",' ||
            '"addressCustomers": "Polite but personable (\"you\", respectful, no first names)",' ||
            '"communicationPurpose": "To educate and inform clearly",' ||
            '"visualMetaphor": "A clever wink (smart, cheeky, friendly)",' ||
            '"languageRegion": "UK English",' ||
            '"competitorVoiceContrast": "Jargon-heavy vs. Plainspoken",' ||
            '"contentGuidelines": "Don''t Be afraid to be different\nDo lead the way",' ||
            '"writtenBy": ""' ||
        '},' ||
        '"organisation": ' || request_data || ',' ||
        '"product": ' || request_data ||
    '}';

    RETURN prompt;
END;
$$;


ALTER FUNCTION "public"."construct_answer_prompt"("faq_pair_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_subscription_raw"("user_id_param" "uuid") RETURNS TABLE("invoice_id" "text", "package_tier" "text", "billing_start" "date", "billing_end" "date", "current_date_val" "date", "is_active" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id::TEXT,
        i.package_tier,
        i.billing_period_start::date,
        i.billing_period_end::date,
        CURRENT_DATE,
        (CURRENT_DATE >= i.billing_period_start::date AND CURRENT_DATE <= i.billing_period_end::date)
    FROM invoices i
    WHERE i.auth_user_id = user_id_param
      AND CURRENT_DATE >= i.billing_period_start::date 
      AND CURRENT_DATE <= i.billing_period_end::date
    ORDER BY i.paid_at DESC
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."debug_subscription_raw"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."format_ai_request"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Get the client configuration for this user
    SELECT 
        CONCAT(
            '"batchDispatchDate": "', TO_CHAR(NEW.batch_date, 'DD/MM/YYYY'),
            '","batchNo": "', NEW.unique_batch_cluster,
            '","uniqueBatchId": "', NEW.unique_batch_id,
            '","faqCountInBatch": ', NEW.batch_faq_pairs,
            ',"email": "', NEW.user_email,
            '","brand": "', NEW.organisation,
            '","industry": "', cc.market_name,
            '","subCategory": "', cc.product_name,
            '","audience": "', cc.audience_name,
            ',"brandContext": ', cc.brand_jsonld_object,
            ',"productContext": ', cc.product_jsonld_object,
            ',"organisationContext": ', cc.organisation_jsonld_object
        ) INTO NEW.ai_request_for_questions
    FROM client_configuration cc
    WHERE cc.auth_user_id = NEW.auth_user_id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."format_ai_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_ai_request_for_answers"("p_unique_batch_id" "text", "p_batch_faq_pairs" integer, "p_organisation" "text", "p_market_name" "text", "p_audience_name" "text", "p_persona_jsonld" "text", "p_product_jsonld_object" "text", "p_question" "text", "p_topic" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN CONCAT(
        'uniqueBatchId: ', p_unique_batch_id,
        ', faqCountInBatch: ', p_batch_faq_pairs,
        ', organisation: ', p_organisation,
        ', industry: ', p_market_name,
        ', audience: ', p_audience_name,
        ', topic: ', p_topic,
        ', question: ', p_question,
        ', product persona: ', p_persona_jsonld,
        ', product: ', p_product_jsonld_object
    );
END;
$$;


ALTER FUNCTION "public"."generate_ai_request_for_answers"("p_unique_batch_id" "text", "p_batch_faq_pairs" integer, "p_organisation" "text", "p_market_name" "text", "p_audience_name" "text", "p_persona_jsonld" "text", "p_product_jsonld_object" "text", "p_question" "text", "p_topic" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_brand_jsonld_object"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.brand_jsonld_object :=
    '{' || chr(10) ||
    '  "@context": "https://schema.org",' || chr(10) ||
    '  "@type": "Brand",' || chr(10) ||
    '  "name": "' || COALESCE(NEW.brand_name, '') || '",' || chr(10) ||
    '  "url": "' || COALESCE(NEW.brand_url, '') || '",' || chr(10) ||
    '  "parentOrganization": {' || chr(10) ||
    '    "@type": "Organization",' || chr(10) ||
    '    "name": "' || COALESCE(NEW.organisation_name, '') || '"' || chr(10) ||
    '  }' || chr(10) ||
    '}';
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_brand_jsonld_object"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_brand_slug"("brand_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    brand_name TEXT;
    org_slug TEXT;
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Get brand name and organization slug
    SELECT b.brand_name, os.slug INTO brand_name, org_slug
    FROM brands b
    JOIN organization_slugs os ON os.organization_id = b.organisation_id
    WHERE b.id = brand_id;
    
    IF brand_name IS NULL OR org_slug IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Generate base slug
    base_slug := generate_slug(brand_name);
    final_slug := base_slug;
    
    -- Check for uniqueness within the organization
    WHILE EXISTS (SELECT 1 FROM brand_slugs WHERE slug = final_slug AND organization_slug = org_slug AND brand_id != brand_id) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter::TEXT;
    END LOOP;
    
    RETURN final_slug;
END;
$$;


ALTER FUNCTION "public"."generate_brand_slug"("brand_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_organisation_jsonld_object"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Generate JSON-LD object for the organization
    NEW.organisation_jsonld_object := jsonb_build_object(
        '@context', 'https://schema.org',
        '@type', 'Organization',
        'name', NEW.organisation_name,
        'url', COALESCE(NEW.organisation_url, ''),
        'description', 'Organization data from BrandAION platform',
        'industry', COALESCE(NEW.industry, ''),
        'subcategory', COALESCE(NEW.subcategory, ''),
        'headquarters', COALESCE(NEW.headquarters, ''),
        'sameAs', CASE 
            WHEN NEW.linkedin_url IS NOT NULL THEN jsonb_build_array(NEW.linkedin_url)
            ELSE '[]'::jsonb
        END
    );
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_organisation_jsonld_object"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_organization_index"("org_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    org_record RECORD;
    brand_record RECORD;
    product_record RECORD;
    index_content TEXT;
    org_slug TEXT;
BEGIN
    -- Get organization info
    SELECT co.organisation_name, os.slug INTO org_record
    FROM client_organisation co
    LEFT JOIN organization_slugs os ON os.organization_id = co.id
    WHERE co.id = org_id;
    
    IF org_record.slug IS NULL THEN
        RETURN NULL;
    END IF;
    
    org_slug := org_record.slug;
    
    index_content := '# ' || org_record.organisation_name || ' - LLM Data Index

## Organization Data
- [Organization Details](organization.jsonld) - Core company information, contact details, industry classification

## Brands
- [Brand Overview](brands/brands-llms.txt) - All brands and sub-brands
';
    
    -- Add brands
    FOR brand_record IN 
        SELECT bs.slug, b.brand_name
        FROM brands b
        JOIN brand_slugs bs ON bs.brand_id = b.id
        WHERE b.organisation_id = org_id AND bs.is_active = true
        ORDER BY b.brand_name
    LOOP
        index_content := index_content || '- [' || brand_record.brand_name || '](brands/' || brand_record.slug || '/brand.jsonld) - Brand details and specifications' || E'\n';
    END LOOP;
    
    index_content := index_content || E'\n## Products
- [Product Catalog](brands/*/products/products-llms.txt) - All products across brands

## FAQ Collections
- [All FAQs](faqs/faqs-llms.txt) - Organization-wide FAQ collections
- [Brand FAQs](brands/*/faqs/faqs-llms.txt) - Brand-specific FAQs
- [Product FAQs](brands/*/products/*/faqs/faqs-llms.txt) - Product-specific FAQs

Last updated: ' || to_char(now(), 'YYYY-MM-DD');
    
    RETURN index_content;
END;
$$;


ALTER FUNCTION "public"."generate_organization_index"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_organization_jsonld"("org_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    org_record RECORD;
    jsonld_data JSONB;
BEGIN
    SELECT 
        co.id,
        co.organisation_name,
        co.organisation_url,
        co.linkedin_url,
        co.industry,
        co.subcategory,
        co.headquarters,
        os.slug
    INTO org_record
    FROM client_organisation co
    LEFT JOIN organization_slugs os ON os.organization_id = co.id
    WHERE co.id = org_id;
    
    IF org_record.id IS NULL THEN
        RETURN NULL;
    END IF;
    
    jsonld_data := jsonb_build_object(
        '@context', 'https://schema.org',
        '@type', 'Organization',
        '@id', 'https://brandaion.com/data/organizations/' || org_record.slug || '/organization.jsonld',
        'name', org_record.organisation_name,
        'url', COALESCE(org_record.organisation_url, ''),
        'description', 'Organization data from BrandAION platform',
        'industry', COALESCE(org_record.industry, ''),
        'subcategory', COALESCE(org_record.subcategory, ''),
        'headquarters', COALESCE(org_record.headquarters, ''),
        'sameAs', CASE 
            WHEN org_record.linkedin_url IS NOT NULL THEN jsonb_build_array(org_record.linkedin_url)
            ELSE '[]'::jsonb
        END
    );
    
    RETURN jsonld_data;
END;
$$;


ALTER FUNCTION "public"."generate_organization_jsonld"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_organization_slug"("org_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    org_name TEXT;
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Get organization name
    SELECT organisation_name INTO org_name 
    FROM client_organisation 
    WHERE id = org_id;
    
    IF org_name IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Generate base slug
    base_slug := generate_slug(org_name);
    final_slug := base_slug;
    
    -- Check for uniqueness and add counter if needed
    WHILE EXISTS (SELECT 1 FROM organization_slugs WHERE slug = final_slug AND organization_id != org_id) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter::TEXT;
    END LOOP;
    
    RETURN final_slug;
END;
$$;


ALTER FUNCTION "public"."generate_organization_slug"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_platform_index"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    index_content TEXT;
    org_record RECORD;
BEGIN
    index_content := '# BrandAION Platform Organizations

This index lists all organizations with LLM-friendly data available on the BrandAION platform.

## Organizations
';
    
    FOR org_record IN 
        SELECT os.slug, co.organisation_name
        FROM organization_slugs os
        JOIN client_organisation co ON co.id = os.organization_id
        WHERE os.is_active = true
        ORDER BY co.organisation_name
    LOOP
        index_content := index_content || '- [' || org_record.organisation_name || '](/data/organizations/' || org_record.slug || '/organization-llms.txt)' || E'\n';
    END LOOP;
    
    index_content := index_content || E'\n## About This Platform

BrandAION provides AI-powered FAQ generation and brand management solutions. Each organization listed above has structured data available including organization details, brands, products, and FAQ collections.

Last updated: ' || to_char(now(), 'YYYY-MM-DD');
    
    RETURN index_content;
END;
$$;


ALTER FUNCTION "public"."generate_platform_index"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_product_schema_json"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.schema_json :=
    '{' || chr(10) ||
    '  "@context": "https://schema.org",' || chr(10) ||
    '  "@type": "Product",' || chr(10) ||
    '  "name": "' || COALESCE(NEW.product_name, '') || '",' || chr(10) ||
    '  "description": "' || COALESCE(NEW.description, '') || '",' || chr(10) ||
    '  "keywords": "' || COALESCE(NEW.keywords, '') || '",' || chr(10) ||
    '  "url": "' || COALESCE(NEW.url, '') || '",' || chr(10) ||
    '  "organisation": {' || chr(10) ||
    '    "@type": "Organization",' || chr(10) ||
    '    "name": "' || COALESCE(NEW.organisation, '') || '"' || chr(10) ||
    '  }' || chr(10) ||
    '}';
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_product_schema_json"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_product_slug"("product_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    product_name TEXT;
    brand_slug TEXT;
    org_slug TEXT;
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Get product name and brand/organization slugs
    SELECT p.product_name, bs.slug, os.slug INTO product_name, brand_slug, org_slug
    FROM products p
    JOIN brand_slugs bs ON bs.brand_id = p.brand_id
    JOIN brands b ON b.id = p.brand_id
    JOIN organization_slugs os ON os.organization_id = b.organisation_id
    WHERE p.id = product_id;
    
    IF product_name IS NULL OR brand_slug IS NULL OR org_slug IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Generate base slug
    base_slug := generate_slug(product_name);
    final_slug := base_slug;
    
    -- Check for uniqueness within the brand
    WHILE EXISTS (SELECT 1 FROM product_slugs WHERE slug = final_slug AND brand_slug = brand_slug AND product_id != product_id) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter::TEXT;
    END LOOP;
    
    RETURN final_slug;
END;
$$;


ALTER FUNCTION "public"."generate_product_slug"("product_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_slug"("input_text" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN lower(
        regexp_replace(
            regexp_replace(
                regexp_replace(input_text, '[^a-zA-Z0-9\s-]', '', 'g'),
                '\s+', '-', 'g'
            ),
            '-+', '-', 'g'
        )
    );
END;
$$;


ALTER FUNCTION "public"."generate_slug"("input_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_package_limits"("package_tier" character varying) RETURNS TABLE("questions_limit" integer, "llms_limit" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.monthly_questions_limit,
        p.monthly_llms_limit
    FROM public.packages p
    WHERE p.pack = package_tier;
END;
$$;


ALTER FUNCTION "public"."get_package_limits"("package_tier" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_package_limits_backup"("pack_name" character varying) RETURNS TABLE("questions_limit" integer, "llms_limit" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.monthly_questions_limit,
        p.monthly_llms_limit
    FROM public.packages p
    WHERE p.pack = pack_name;
END;
$$;


ALTER FUNCTION "public"."get_package_limits_backup"("pack_name" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_organization_slug_safe"("p_organization_id" "uuid", "p_slug" "text", "p_organization_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO organization_slugs (organization_id, slug, organization_name)
    VALUES (p_organization_id, p_slug, p_organization_name)
    ON CONFLICT (organization_id) 
    DO UPDATE SET 
        slug = EXCLUDED.slug,
        organization_name = EXCLUDED.organization_name,
        updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."insert_organization_slug_safe"("p_organization_id" "uuid", "p_slug" "text", "p_organization_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_stripe_invoice"("p_email" "text", "p_amount_cents" integer, "p_amount_gbp" numeric, "p_paid_at" timestamp with time zone, "p_hosted_invoice_url" "text", "p_invoice_pdf_url" "text", "p_status" "text", "p_package_tier" "text", "p_faq_pairs_pm" integer, "p_faq_per_batch" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_auth_user_id UUID;
  v_batch_1 TIMESTAMPTZ;
  v_batch_2 TIMESTAMPTZ;
  v_batch_3 TIMESTAMPTZ;
  v_batch_4 TIMESTAMPTZ;
BEGIN
  -- Retrieve auth_user_id from auth.users based on email
  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = p_email
  LIMIT 1;

  -- If no matching user is found, log a notice and exit
  IF v_auth_user_id IS NULL THEN
    RAISE NOTICE 'No auth user found for email: %', p_email;
    RETURN;
  END IF;

  -- Calculate batch dates
  v_batch_1 := p_paid_at;
  v_batch_2 := p_paid_at + INTERVAL '7 days';
  v_batch_3 := p_paid_at + INTERVAL '14 days';
  v_batch_4 := p_paid_at + INTERVAL '21 days';

  -- Insert the invoice into stripe_invoices table
  INSERT INTO stripe_invoices (
    email,
    auth_user_id,
    amount_cents,
    amount_gbp,
    paid_at,
    batch_1,
    batch_2,
    batch_3,
    batch_4,
    hosted_invoice_url,
    invoice_pdf_url,
    status,
    package_tier,
    faq_pairs_pm,
    faq_per_batch,
    sent_to_schedule
  )
  VALUES (
    p_email,
    v_auth_user_id,
    p_amount_cents,
    p_amount_gbp,
    p_paid_at,
    v_batch_1,
    v_batch_2,
    v_batch_3,
    v_batch_4,
    p_hosted_invoice_url,
    p_invoice_pdf_url,
    p_status,
    p_package_tier,
    p_faq_pairs_pm,
    p_faq_per_batch,
    FALSE
  );
END;
$$;


ALTER FUNCTION "public"."insert_stripe_invoice"("p_email" "text", "p_amount_cents" integer, "p_amount_gbp" numeric, "p_paid_at" timestamp with time zone, "p_hosted_invoice_url" "text", "p_invoice_pdf_url" "text", "p_status" "text", "p_package_tier" "text", "p_faq_pairs_pm" integer, "p_faq_per_batch" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_stripe_invoice"("p_email" "text", "p_amount_cents" bigint, "p_amount_gbp" numeric, "p_paid_at" timestamp with time zone, "p_hosted_invoice_url" "text", "p_invoice_pdf_url" "text", "p_status" "text", "p_package_tier" "text", "p_faq_pairs_pm" integer, "p_faq_per_batch" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_auth_user_id uuid;
    v_batch_1_date timestamp with time zone;
    v_batch_2_date timestamp with time zone;
    v_batch_3_date timestamp with time zone;
    v_batch_4_date timestamp with time zone;
BEGIN
    -- Match the email with end_user table to get auth_user_id
    SELECT auth_user_id INTO v_auth_user_id
    FROM end_user
    WHERE email = p_email
    LIMIT 1;

    IF v_auth_user_id IS NULL THEN
        RAISE NOTICE 'No user found with email %', p_email;
        RETURN;
    END IF;

    -- Calculate dispatch dates
    v_batch_1_date := p_paid_at + interval '1 day';
    v_batch_2_date := p_paid_at + interval '8 days';
    v_batch_3_date := p_paid_at + interval '15 days';
    v_batch_4_date := p_paid_at + interval '22 days';

    -- Insert into invoices table
    INSERT INTO public.invoices (
        user_email, auth_user_id, amount_cents, amount_gbp, paid_at,
        batch_1_date, batch_2_date, batch_3_date, batch_4_date,
        hosted_invoice_url, invoice_pdf_url, status, inserted_at,
        package_tier, faq_pairs_pm, faq_per_batch, sent_to_schedule
    ) VALUES (
        p_email, v_auth_user_id, p_amount_cents, p_amount_gbp, p_paid_at,
        v_batch_1_date, v_batch_2_date, v_batch_3_date, v_batch_4_date,
        p_hosted_invoice_url, p_invoice_pdf_url, p_status, now(),
        p_package_tier, p_faq_pairs_pm, p_faq_per_batch, false
    );
END;
$$;


ALTER FUNCTION "public"."insert_stripe_invoice"("p_email" "text", "p_amount_cents" bigint, "p_amount_gbp" numeric, "p_paid_at" timestamp with time zone, "p_hosted_invoice_url" "text", "p_invoice_pdf_url" "text", "p_status" "text", "p_package_tier" "text", "p_faq_pairs_pm" integer, "p_faq_per_batch" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_end_user_to_organisation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  org_id UUID;
BEGIN
  IF NEW.org_name IS NOT NULL THEN
    -- Look for existing org
    SELECT id INTO org_id FROM client_organisation WHERE organisation_name = NEW.org_name;

    -- If not found, create it
    IF org_id IS NULL THEN
      INSERT INTO client_organisation (organisation_name, auth_user_id)
      VALUES (NEW.org_name, NEW.auth_user_id)
      RETURNING id INTO org_id;
    END IF;

    -- Assign to end_user
    NEW.organisation_id := org_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."link_end_user_to_organisation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_org_to_end_user"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Link the organization to the end_user record
    UPDATE end_users 
    SET 
        org_name = NEW.organisation_name,
        organisation_id = NEW.id
    WHERE auth_user_id = NEW.auth_user_id;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."link_org_to_end_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_user_email"("email_input" "text") RETURNS TABLE("id" "uuid", "email" "text")
    LANGUAGE "sql" STABLE
    AS $$
select id, email
from end_users
where lower(trim(email)) = lower(trim(email_input));
$$;


ALTER FUNCTION "public"."match_user_email"("email_input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."patch_auth_user_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE invoices
  SET auth_user_id = e.id
  FROM end_users e
  WHERE invoices.id = NEW.id
    AND invoices.auth_user_id IS NULL
    AND LOWER(TRIM(e.email)) = LOWER(TRIM(NEW.user_email));

  RETURN NULL; -- AFTER triggers should return NULL
END;
$$;


ALTER FUNCTION "public"."patch_auth_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."patch_auth_user_id_on_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE invoices
  SET auth_user_id = e.id
  FROM end_users e
  WHERE invoices.id = NEW.id
    AND invoices.auth_user_id IS NULL
    AND LOWER(TRIM(e.email)) = LOWER(TRIM(NEW.user_email));

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."patch_auth_user_id_on_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."populate_invoice_package_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  pkg RECORD;
BEGIN
  RAISE NOTICE 'Incoming amount_cents: %', NEW.amount_cents;

  SELECT * INTO pkg
  FROM packages
  WHERE amount_cents = NEW.amount_cents
  LIMIT 1;

  IF FOUND THEN
    RAISE NOTICE 'Matched package: %', pkg.tier;
    NEW.package_tier := pkg.tier;
    NEW.faq_pairs_pm := pkg.faq_pairs_pm::INTEGER;
    NEW.faq_per_batch := pkg.faq_per_batch::INTEGER;
  ELSE
    RAISE NOTICE 'No package matched amount_cents: %', NEW.amount_cents;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."populate_invoice_package_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_stripe_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  session jsonb;
  invoice_id text;
  user_email text;
  amount_cents integer;
  stripe_payment_id text;
  paid_at timestamp with time zone;
  billing_period_start timestamp with time zone;
  billing_period_end timestamp with time zone;
BEGIN
  -- Process both invoice.paid and checkout.session.completed events
  IF NEW.type NOT IN ('invoice.paid', 'checkout.session.completed') THEN
    RETURN NEW;
  END IF;

  session := NEW.payload -> 'data' -> 'object';
  
  -- Handle different event types
  IF NEW.type = 'invoice.paid' THEN
    -- Invoice paid event
    invoice_id := session ->> 'id';
    user_email := session ->> 'customer_email';
    amount_cents := (session ->> 'amount_paid')::integer;
    stripe_payment_id := session ->> 'id';
    paid_at := to_timestamp((session ->> 'created')::integer);
    billing_period_start := to_timestamp((session ->> 'period_start')::integer);
    billing_period_end := to_timestamp((session ->> 'period_end')::integer);
  ELSIF NEW.type = 'checkout.session.completed' THEN
    -- Checkout session completed event
    invoice_id := gen_random_uuid()::text;
    user_email := session -> 'customer_details' ->> 'email';
    amount_cents := (session ->> 'amount_total')::integer;
    stripe_payment_id := session ->> 'id';
    paid_at := to_timestamp((session ->> 'created')::integer);
    
    -- For checkout sessions, we need to calculate billing periods
    -- Assuming monthly billing, set period start to now and end to 1 month from now
    billing_period_start := to_timestamp((session ->> 'created')::integer);
    billing_period_end := billing_period_start + interval '1 month';
  END IF;

  -- Create invoice - let SQL functions handle package_tier, organisation, etc.
  INSERT INTO invoices (
    id,
    user_email,
    amount_cents,
    stripe_payment_id,
    billing_period_start,
    billing_period_end,
    paid_at,
    faq_pairs_pm,
    faq_per_batch,
    inserted_at,
    sent_to_schedule
  ) VALUES (
    invoice_id,
    user_email,
    amount_cents,
    stripe_payment_id,
    billing_period_start,
    billing_period_end,
    paid_at,
    20,  -- Default FAQ pairs per month
    5,   -- Default FAQ per batch
    NOW(),
    false
  );

  -- Mark webhook as processed
  UPDATE stripe_webhook_log
  SET processed = true
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."process_stripe_webhook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_webhook"("stripe_id" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  raw jsonb;
  stripe_invoice text;
  email text;
  user_id uuid;
begin
  -- 1. Load the raw webhook payload
  select payload into raw
  from raw_stripe_webhooks
  where id = stripe_id;

  -- 2. Extract and clean email + invoice ID
  stripe_invoice := raw->'data'->'object'->>'id';
  email := lower(trim(raw->'data'->'object'->>'customer_email'));

  -- 3. Find matching user
  select id into user_id
  from end_users
  where lower(trim(email)) = email
  limit 1;

  -- 4. Insert into invoices (if not exists)
  insert into invoices (
    id,
    auth_user_id,
    user_email,
    amount_cents,
    amount_gbp,
    hosted_invoice_url,
    invoice_pdf_url,
    status
  )
  values (
    stripe_invoice,
    user_id,
    email,
    (raw->'data'->'object'->>'amount_due')::int,
    (raw->'data'->'object'->>'amount_due')::numeric / 100,
    raw->'data'->'object'->>'hosted_invoice_url',
    raw->'data'->'object'->>'invoice_pdf',
    raw->'data'->'object'->>'status'
  )
  on conflict (id) do nothing;
end;
$$;


ALTER FUNCTION "public"."process_webhook"("stripe_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_auth_user_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  matched_id UUID;
BEGIN
  SELECT id INTO matched_id
  FROM end_users
  WHERE email = NEW.user_email
  LIMIT 1;

  RAISE NOTICE 'Matched ID for %: %', NEW.user_email, matched_id;

  IF matched_id IS NOT NULL THEN
    NEW.auth_user_id := matched_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_auth_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_billing_periods"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Set billing periods based on paid_at
    NEW.billing_period_start := NEW.paid_at;
    NEW.billing_period_end := NEW.paid_at + INTERVAL '1 month';
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_billing_periods"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_invoice_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    found_auth_user_id UUID;
BEGIN
    -- Look up the auth_user_id from end_users table using the email
    SELECT auth_user_id INTO found_auth_user_id
    FROM end_users
    WHERE email = NEW.user_email
    LIMIT 1;

    -- If we found a matching user, set the auth_user_id
    IF found_auth_user_id IS NOT NULL THEN
        NEW.auth_user_id := found_auth_user_id;
    ELSE
        -- If no user found, set to NULL to avoid foreign key constraint error
        NEW.auth_user_id := NULL;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_invoice_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_invoice_batches"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.subscription_ends_at := new.paid_at::date + interval '30 days';
  new.batch_1_date := new.paid_at::date + interval '1 day';
  new.batch_2_date := new.paid_at::date + interval '8 days';
  new.batch_3_date := new.paid_at::date + interval '15 days';
  new.batch_4_date := new.paid_at::date + interval '22 days';
  return new;
end;
$$;


ALTER FUNCTION "public"."set_invoice_batches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."simple_test"("user_id_param" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    invoice_count INTEGER;
BEGIN
    -- Count invoices for this user
    SELECT COUNT(*) INTO invoice_count
    FROM invoices
    WHERE auth_user_id = user_id_param
      AND CURRENT_DATE >= billing_period_start::date 
      AND CURRENT_DATE <= billing_period_end::date;
    
    RETURN 'Found ' || invoice_count || ' active invoices for user ' || user_id_param;
END;
$$;


ALTER FUNCTION "public"."simple_test"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."split_questions_into_review"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
    question_line TEXT;
    clean_question TEXT;
    topic_name TEXT;
    question_text TEXT;
    bracket_pos INTEGER;
BEGIN
    -- Only process when question_status changes to 'questions_generated'
    IF NEW.question_status = 'questions_generated' AND NEW.ai_response_questions IS NOT NULL THEN
        
        -- Clear any existing questions for this construct_faq_pair (in case of re-processing)
        DELETE FROM review_questions WHERE unique_batch_id = NEW.unique_batch_id;
        
        -- Split by newlines and process each line
        FOR question_line IN SELECT unnest(string_to_array(NEW.ai_response_questions, E'\n'))
        LOOP
            -- Clean the line (remove numbering, trim whitespace)
            clean_question := trim(regexp_replace(question_line, '^[0-9]+\.\s*', ''));
            
            -- Only process if we have actual content and the correct format
            IF length(clean_question) > 10 AND clean_question ~ '^\[.+?\]\[.+?\]$' THEN
                
                -- Extract topic name (text between first [ and first ])
                topic_name := substring(clean_question from '^\[([^\]]+)\]');
                
                -- Extract question text (text between second [ and last ])
                question_text := substring(clean_question from '\[([^\]]+)\]$');
                
                -- Only insert if we successfully extracted both topic and question
                IF topic_name IS NOT NULL AND question_text IS NOT NULL AND length(topic_name) > 0 AND length(question_text) > 0 THEN
                    INSERT INTO review_questions (
                        unique_batch_cluster,
                        unique_batch_id,
                        batch_date,
                        organisation,
                        user_email,
                        auth_user_id,
                        product_name,
                        persona_name,
                        audience_name,
                        market_name,
                        question,
                        topic,
                        answer_status,
                        question_status,
                        persona_jsonld,
                        product_jsonld_object,
                        organisation_jsonld_object
                    ) VALUES (
                        NEW.unique_batch_cluster,
                        NEW.unique_batch_id,
                        NEW.batch_date,
                        NEW.organisation,
                        NEW.user_email,
                        NEW.auth_user_id,
                        NEW.product_name,
                        NEW.persona_name,
                        NEW.audience_name,
                        NEW.market_name,
                        question_text,
                        topic_name,
                        'pending',
                        NEW.question_status,
                        NEW.persona_jsonld,
                        NEW.product_jsonld_object,
                        NEW.brand_jsonld_object
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."split_questions_into_review"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_org_jsonld_to_config"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- This function can be used to sync organization JSON-LD to other tables if needed
    -- For now, just return NEW to avoid errors
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_org_jsonld_to_config"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_invoice_lookup"("user_id_param" "uuid") RETURNS TABLE("found_invoice" boolean, "package_tier" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    latest_invoice RECORD;
BEGIN
    -- Get latest invoice where current date is within billing period
    SELECT * INTO latest_invoice
    FROM invoices
    WHERE auth_user_id = user_id_param
      AND CURRENT_DATE >= billing_period_start::date 
      AND CURRENT_DATE <= billing_period_end::date
    ORDER BY paid_at DESC
    LIMIT 1;
    
    RETURN QUERY
    SELECT 
        (latest_invoice IS NOT NULL),
        COALESCE(latest_invoice.package_tier, 'null'::TEXT);
END;
$$;


ALTER FUNCTION "public"."test_invoice_lookup"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_simple_lookup"("user_id_param" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    invoice_id TEXT;
BEGIN
    SELECT id::TEXT INTO invoice_id
    FROM invoices
    WHERE auth_user_id = user_id_param
      AND CURRENT_DATE >= billing_period_start::date 
      AND CURRENT_DATE <= billing_period_end::date
    ORDER BY paid_at DESC
    LIMIT 1;
    
    IF invoice_id IS NOT NULL THEN
        RETURN 'Found invoice: ' || invoice_id;
    ELSE
        RETURN 'No invoice found';
    END IF;
END;
$$;


ALTER FUNCTION "public"."test_simple_lookup"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_subscription_debug"("user_id_param" "uuid") RETURNS TABLE("debug_info" "text", "user_email" "text", "invoice_found" boolean, "package_tier" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    user_email_val TEXT;
    latest_invoice RECORD;
BEGIN
    -- Get user's email
    SELECT email INTO user_email_val
    FROM auth.users
    WHERE id = user_id_param;
    
    -- Get latest invoice
    SELECT * INTO latest_invoice
    FROM invoices
    WHERE user_email = user_email_val
      AND CURRENT_DATE >= billing_period_start::date 
      AND CURRENT_DATE <= billing_period_end::date
    ORDER BY paid_at DESC
    LIMIT 1;
    
    RETURN QUERY
    SELECT 
        'Debug info'::TEXT,
        user_email_val,
        (latest_invoice IS NOT NULL),
        COALESCE(latest_invoice.package_tier, 'null'::TEXT);
END;
$$;


ALTER FUNCTION "public"."test_subscription_debug"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_generate_organization_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := generate_organization_slug(NEW.id);
    END IF;
    
    -- Use the security definer function instead of direct insert
    PERFORM insert_organization_slug_safe(NEW.id, NEW.slug, NEW.organisation_name);
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_generate_organization_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_llm_discovery_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_llm_discovery_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_persona_jsonld"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.persona_jsonld :=
    '{' ||
    '"coreValue": "' || COALESCE(NEW.core_brand_value, '') || '", ' ||
    '"toneOfVoice": "' || COALESCE(NEW.brand_tone_of_voice, '') || '", ' ||
    '"archetype": "' || COALESCE(NEW.brand_archetype, '') || '", ' ||
    '"customerEmotion": "' || COALESCE(NEW.customer_emotions, '') || '", ' ||
    '"formality": "' || COALESCE(NEW.communication_style, '') || '", ' ||
    '"humorStyle": "' || COALESCE(NEW.brand_voice_humor, '') || '", ' ||
    '"languageComplexity": "' || COALESCE(NEW.language_complexity, '') || '", ' ||
    '"emotionallyExpressive": "' || COALESCE(NEW.emotional_expressiveness, '') || '", ' ||
    '"wordsToAvoid": "' || COALESCE(NEW.words_to_avoid, '') || '", ' ||
    '"addressCustomers": "' || COALESCE(NEW.customer_address_style, '') || '", ' ||
    '"communicationPurpose": "' || COALESCE(NEW.brand_communication_purpose, '') || '", ' ||
    '"visualMetaphor": "' || COALESCE(NEW.brand_visual_metaphor, '') || '", ' ||
    '"languageRegion": "' || COALESCE(NEW.language_region_preference, '') || '", ' ||
    '"competitorVoiceContrast": "' || COALESCE(NEW.competitor_voice_contrast, '') || '", ' ||
    '"contentGuidelines": "' || COALESCE(NEW.content_dos_and_donts, '') || '", ' ||
    '"writtenBy": "' || COALESCE(NEW.copywriter_type, '') || '"' ||
    '}';
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_persona_jsonld"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_persona_summary"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.persona_summary :=
    'Core value: ' || COALESCE(NEW.core_brand_value, '') ||
    '. Tone of voice: ' || COALESCE(NEW.brand_tone_of_voice, '') ||
    '. Archetype: ' || COALESCE(NEW.brand_archetype, '') ||
    '. Customers should feel: ' || COALESCE(NEW.customer_emotions, '') ||
    '. Formality: ' || COALESCE(NEW.communication_style, '') ||
    '. Humor style: ' || COALESCE(NEW.brand_voice_humor, '') ||
    '. Language complexity: ' || COALESCE(NEW.language_complexity, '') ||
    '. Words to avoid: ' || COALESCE(NEW.words_to_avoid, '') ||
    '. Communication purpose: ' || COALESCE(NEW.brand_communication_purpose, '') ||
    '. Visual metaphor: ' || COALESCE(NEW.brand_visual_metaphor, '') ||
    '. Language & region: ' || COALESCE(NEW.language_region_preference, '') ||
    '. Competitor voice contrast: ' || COALESCE(NEW.competitor_voice_contrast, '') ||
    '. Content guidelines: ' || COALESCE(NEW.content_dos_and_donts, '') ||
    '. Created by: ' || COALESCE(NEW.copywriter_type, '') || '.';
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_persona_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audiences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_audience" "text" NOT NULL,
    "json_audience" "jsonb",
    "detailed_audience" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audiences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."batch_faq_pairs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unique_batch_id" "text" NOT NULL,
    "unique_batch_cluster" "text" NOT NULL,
    "batch_date" "date" NOT NULL,
    "organisation" "text" NOT NULL,
    "brand" "text" NOT NULL,
    "product" "text" NOT NULL,
    "audience" "text" NOT NULL,
    "faq_count_in_batch" integer NOT NULL,
    "faq_pairs_object" "jsonb" NOT NULL,
    "batch_status" "text" DEFAULT 'batch_generated'::"text",
    "auth_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "batch_faq_pairs_batch_status_check" CHECK (("batch_status" = ANY (ARRAY['batch_generated'::"text", 'batch_published'::"text"])))
);


ALTER TABLE "public"."batch_faq_pairs" OWNER TO "postgres";


COMMENT ON TABLE "public"."batch_faq_pairs" IS 'Stores compiled FAQ batches in LLM-friendly JSON format for training and retrieval';



CREATE TABLE IF NOT EXISTS "public"."brand_slugs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "slug" character varying(255) NOT NULL,
    "brand_name" character varying(255) NOT NULL,
    "organization_slug" character varying(255) NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."brand_slugs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "organisation_id" "uuid" NOT NULL,
    "organisation_name" "text" NOT NULL,
    "brand_name" "text",
    "brand_url" "text",
    "brand_jsonld_object" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "slug" character varying(255)
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_configuration" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid",
    "organisation_name" "text",
    "brand_id" "uuid",
    "product_id" "uuid",
    "persona_id" "uuid",
    "audience_id" "uuid",
    "market_id" "uuid",
    "brand_name" "text",
    "product_name" "text",
    "persona_name" "text",
    "audience_name" "text",
    "market_name" "text",
    "brand_jsonld_object" "text",
    "schema_json" "text",
    "persona_jsonld" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "organisation_jsonld_object" "text"
);


ALTER TABLE "public"."client_configuration" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_organisation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_url" "text",
    "linkedin_url" "text",
    "auth_user_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "organisation_name" "text" DEFAULT ''::"text" NOT NULL,
    "organisation_jsonld_object" "text",
    "industry" "text",
    "subcategory" "text",
    "headquarters" "text",
    "slug" character varying(255)
);


ALTER TABLE "public"."client_organisation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_product_persona" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "organisation_name" "text" NOT NULL,
    "core_brand_value" "text",
    "brand_tone_of_voice" "text",
    "brand_archetype" "text",
    "customer_emotions" "text",
    "communication_style" "text",
    "brand_voice_humor" "text",
    "language_complexity" "text",
    "emotional_expressiveness" "text",
    "words_to_avoid" "text",
    "customer_address_style" "text",
    "brand_communication_purpose" "text",
    "brand_tagline" "text",
    "brand_visual_metaphor" "text",
    "language_region_preference" "text",
    "competitor_voice_contrast" "text",
    "content_dos_and_donts" "text",
    "copywriter_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "persona_summary" "text",
    "product_name" "text",
    "persona_jsonld" "text",
    "persona_name" "text"
);


ALTER TABLE "public"."client_product_persona" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_product_persona" IS 'Updated to remove product_id column - personas are now completely independent entities';



CREATE TABLE IF NOT EXISTS "public"."construct_faq_pairs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "unique_batch_cluster" "text",
    "unique_batch_id" "text",
    "batch_date" "date",
    "batch_faq_pairs" integer,
    "total_faq_pairs" integer,
    "organisation" "text",
    "user_email" "text",
    "auth_user_id" "uuid",
    "organisation_id" "uuid",
    "product_name" "text",
    "persona_name" "text",
    "audience_name" "text",
    "market_name" "text",
    "brand_jsonld_object" "text",
    "product_jsonld_object" "text",
    "persona_jsonld" "text",
    "ai_request_for_questions" "text",
    "ai_response_questions" "text",
    "ai_request_for_answers" "text",
    "question_status" "text" DEFAULT 'pending'::"text",
    "error_message" "text",
    "organisation_jsonld_object" "text",
    CONSTRAINT "construct_faq_pairs_question_status_check" CHECK (("question_status" = ANY (ARRAY['pending'::"text", 'questions_generated'::"text"])))
);


ALTER TABLE "public"."construct_faq_pairs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debug_log" (
    "id" integer NOT NULL,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "inserted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."debug_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."debug_log_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."debug_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."debug_log_id_seq" OWNED BY "public"."debug_log"."id";



CREATE TABLE IF NOT EXISTS "public"."end_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "full_name" "text" GENERATED ALWAYS AS ((("first_name" || ' '::"text") || "last_name")) STORED,
    "org_name" "text",
    "status" "text" DEFAULT 'active'::"text",
    "profile_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "auth_user_id" "uuid",
    "organisation_id" "uuid",
    "inserted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."end_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."failed_invoices" (
    "id" "text" NOT NULL,
    "customer_email" "text",
    "reason" "text",
    "raw_payload" "jsonb",
    "received_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."failed_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faq_performance_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "test_date" timestamp with time zone DEFAULT "now"(),
    "ai_provider" "text" NOT NULL,
    "question_id" bigint,
    "question_text" "text" NOT NULL,
    "expected_answer" "text" NOT NULL,
    "ai_response" "text",
    "response_time_ms" integer,
    "accuracy_score" numeric(5,2),
    "token_usage" integer,
    "cost_usd" numeric(10,4),
    "status" "text" DEFAULT 'pending'::"text",
    "error_message" "text",
    "test_schedule" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "openai_response" "text",
    "gemini_response" "text",
    "perplexity_response" "text",
    "claude_response" "text",
    "openai_accuracy_score" numeric(5,2),
    "gemini_accuracy_score" numeric(5,2),
    "perplexity_accuracy_score" numeric(5,2),
    "claude_accuracy_score" numeric(5,2),
    "openai_cost_usd" numeric(10,4),
    "gemini_cost_usd" numeric(10,4),
    "perplexity_cost_usd" numeric(10,4),
    "claude_cost_usd" numeric(10,4),
    "openai_token_usage" integer,
    "gemini_token_usage" integer,
    "perplexity_token_usage" integer,
    "claude_token_usage" integer,
    "openai_response_time_ms" integer,
    "gemini_response_time_ms" integer,
    "perplexity_response_time_ms" integer,
    "claude_response_time_ms" integer,
    "openai_status" "text" DEFAULT 'pending'::"text",
    "gemini_status" "text" DEFAULT 'pending'::"text",
    "perplexity_status" "text" DEFAULT 'pending'::"text",
    "claude_status" "text" DEFAULT 'pending'::"text",
    "openai_error_message" "text",
    "gemini_error_message" "text",
    "perplexity_error_message" "text",
    "claude_error_message" "text",
    "tested_llms" "text"[] DEFAULT ARRAY[]::"text"[],
    "test_month" "date",
    CONSTRAINT "faq_performance_logs_ai_provider_check" CHECK (("ai_provider" = ANY (ARRAY['openai'::"text", 'perplexity'::"text", 'gemini'::"text", 'claude'::"text", 'custom'::"text"]))),
    CONSTRAINT "faq_performance_logs_claude_status_check" CHECK (("claude_status" = ANY (ARRAY['pending'::"text", 'success'::"text", 'error'::"text", 'timeout'::"text"]))),
    CONSTRAINT "faq_performance_logs_gemini_status_check" CHECK (("gemini_status" = ANY (ARRAY['pending'::"text", 'success'::"text", 'error'::"text", 'timeout'::"text"]))),
    CONSTRAINT "faq_performance_logs_openai_status_check" CHECK (("openai_status" = ANY (ARRAY['pending'::"text", 'success'::"text", 'error'::"text", 'timeout'::"text"]))),
    CONSTRAINT "faq_performance_logs_perplexity_status_check" CHECK (("perplexity_status" = ANY (ARRAY['pending'::"text", 'success'::"text", 'error'::"text", 'timeout'::"text"]))),
    CONSTRAINT "faq_performance_logs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'success'::"text", 'error'::"text", 'timeout'::"text"]))),
    CONSTRAINT "faq_performance_logs_test_schedule_check" CHECK (("test_schedule" = ANY (ARRAY['manual'::"text", 'weekly'::"text", 'monthly'::"text"])))
);


ALTER TABLE "public"."faq_performance_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."faq_performance_logs" IS 'Restructured to support individual LLM response tracking. Each test can now store responses from multiple LLMs simultaneously.';



CREATE TABLE IF NOT EXISTS "public"."industries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "metadata" "jsonb",
    "naics_code" "text",
    "nace_code" "text",
    "uk_sic" "text"
);


ALTER TABLE "public"."industries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "auth_user_id" "uuid",
    "amount_cents" integer NOT NULL,
    "paid_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subscription_ends_at" "date",
    "batch_1_date" "date",
    "batch_2_date" "date",
    "batch_3_date" "date",
    "batch_4_date" "date",
    "status" "text",
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    "package_tier" "text",
    "faq_pairs_pm" integer,
    "faq_per_batch" integer,
    "sent_to_schedule" boolean DEFAULT false,
    "currency" "text",
    "stripe_payment_id" "text",
    "billing_period_start" timestamp with time zone,
    "billing_period_end" timestamp with time zone,
    "organisation" character varying(255)
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."llm_discovery_faq_objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_faq_pairs_id" "uuid" NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "client_organisation_id" "uuid" NOT NULL,
    "brand_id" "uuid",
    "product_id" "uuid",
    "week_start_date" "date" NOT NULL,
    "faq_json_object" "jsonb",
    "organization_jsonld" "jsonb",
    "brand_jsonld" "jsonb",
    "product_jsonld" "jsonb",
    "last_generated" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."llm_discovery_faq_objects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."llm_discovery_static" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "client_organisation_id" "uuid" NOT NULL,
    "organization_jsonld" "jsonb",
    "brand_jsonld" "jsonb",
    "product_jsonld" "jsonb",
    "last_generated" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."llm_discovery_static" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."markets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "region" "text",
    "iso_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."markets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_slugs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "slug" character varying(255) NOT NULL,
    "organization_name" character varying(255) NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organization_slugs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packages" (
    "tier" "text" NOT NULL,
    "faq_pairs_pm" integer,
    "faq_per_batch" integer,
    "batches_required" integer,
    "price_per_faq" numeric(10,2),
    "package_cost" numeric(10,2),
    "cogs_per_faq" numeric(10,2),
    "cogs_total" numeric(10,2),
    "profit" numeric(10,2),
    "profit_margin" "text",
    "positioning" "text",
    "sales_message" "text",
    "amount_cents" numeric,
    "monthly_questions_limit" integer,
    "monthly_llms_limit" integer,
    "monthly_price_cents" integer,
    "monthly_description" "text",
    "pack" "text",
    CONSTRAINT "packages_monthly_llms_limit_check" CHECK (("monthly_llms_limit" = ANY (ARRAY[1, 2, 3, 4]))),
    CONSTRAINT "packages_monthly_questions_limit_check" CHECK (("monthly_questions_limit" = ANY (ARRAY[5, 10, 15, 20]))),
    CONSTRAINT "packages_pack_check" CHECK (("pack" = ANY (ARRAY['pack1'::"text", 'pack2'::"text", 'pack3'::"text", 'pack4'::"text"])))
);


ALTER TABLE "public"."packages" OWNER TO "postgres";


COMMENT ON TABLE "public"."packages" IS 'Packages for both FAQ generation and monthly performance monitoring';



COMMENT ON COLUMN "public"."packages"."amount_cents" IS 'the amount in cents';



COMMENT ON COLUMN "public"."packages"."monthly_questions_limit" IS 'Number of questions user can select for monthly performance monitoring';



COMMENT ON COLUMN "public"."packages"."monthly_llms_limit" IS 'Number of LLM providers user can select for monthly performance testing';



COMMENT ON COLUMN "public"."packages"."monthly_price_cents" IS 'Monthly price for performance monitoring in cents';



COMMENT ON COLUMN "public"."packages"."monthly_description" IS 'Description of monthly performance monitoring features';



COMMENT ON COLUMN "public"."packages"."pack" IS 'Static backend identifier (pack1-pack4) that never changes, allowing tier names to be updated without code changes';



CREATE TABLE IF NOT EXISTS "public"."product_slugs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "slug" character varying(255) NOT NULL,
    "product_name" character varying(255) NOT NULL,
    "brand_slug" character varying(255) NOT NULL,
    "organization_slug" character varying(255) NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_slugs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_email" "text",
    "organisation" "text",
    "product_name" "text",
    "description" "text",
    "category" "text",
    "keywords" "text",
    "url" "text",
    "schema_json" "text",
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    "auth_user_id" "uuid",
    "organisation_id" "uuid",
    "brand_id" "uuid",
    "slug" character varying(255)
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_questions" (
    "id" bigint NOT NULL,
    "unique_batch_cluster" "text",
    "unique_batch_id" "text",
    "batch_date" timestamp with time zone,
    "organisation" "text",
    "user_email" "text",
    "auth_user_id" "uuid",
    "product_name" "text",
    "persona_name" "text",
    "audience_name" "text",
    "market_name" "text",
    "ai_request_for_answers" "text",
    "question" "text" NOT NULL,
    "error_message" "text",
    "answer_status" "text" DEFAULT 'pending'::"text",
    "ai_response_answers" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "question_status" "text",
    "topic" "text",
    "batch_faq_pairs" integer,
    "ai_response_questions" "text",
    "persona_jsonld" "text",
    "product_jsonld_object" "text",
    "organisation_jsonld_object" "text",
    CONSTRAINT "approved_questions_answer_status_check" CHECK (("answer_status" = ANY (ARRAY['pending'::"text", 'generating'::"text", 'completed'::"text", 'failed'::"text", 'approved'::"text"])))
);


ALTER TABLE "public"."review_questions" OWNER TO "postgres";


COMMENT ON TABLE "public"."review_questions" IS 'This is a duplicate of approved_questions';



CREATE TABLE IF NOT EXISTS "public"."schedule" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "organisation_id" "uuid" NOT NULL,
    "unique_batch_cluster" "uuid" NOT NULL,
    "unique_batch_id" "uuid" NOT NULL,
    "batch_date" "date" NOT NULL,
    "batch_faq_pairs" integer NOT NULL,
    "total_faq_pairs" integer NOT NULL,
    "sent_for_processing" boolean DEFAULT false NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "organisation" character varying(255),
    "user_email" character varying(255)
);


ALTER TABLE "public"."schedule" OWNER TO "postgres";


CREATE FOREIGN TABLE "public"."stripe_sandbox" (
    "id" "text",
    "customer" "text",
    "subscription" "text",
    "status" "text",
    "total" bigint,
    "currency" "text",
    "period_start" timestamp without time zone,
    "period_end" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "stripe_sandbox_server"
OPTIONS (
    "id" '49473',
    "object" 'invoices',
    "schema" 'public'
);


ALTER FOREIGN TABLE "public"."stripe_sandbox" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_webhook_log" (
    "id" "text" NOT NULL,
    "type" "text",
    "payload" "jsonb",
    "received_at" timestamp with time zone DEFAULT "now"(),
    "processed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stripe_webhook_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subcategories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "industry_id" "uuid"
);


ALTER TABLE "public"."subcategories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_monthly_llms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "llm_provider" "text" NOT NULL,
    "package_tier" character varying(20) NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_monthly_llms_llm_provider_check" CHECK (("llm_provider" = ANY (ARRAY['openai'::"text", 'gemini'::"text", 'perplexity'::"text", 'claude'::"text"]))),
    CONSTRAINT "user_monthly_llms_package_tier_check" CHECK ((("package_tier")::"text" = ANY ((ARRAY['pack1'::character varying, 'pack2'::character varying, 'pack3'::character varying, 'pack4'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_monthly_llms" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_monthly_llms" IS 'Tracks which LLMs users have selected for monthly performance testing using pack1-pack4 system';



CREATE TABLE IF NOT EXISTS "public"."user_monthly_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "question_id" bigint NOT NULL,
    "package_tier" character varying(20) NOT NULL,
    "added_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_monthly_questions_package_tier_check" CHECK ((("package_tier")::"text" = ANY ((ARRAY['pack1'::character varying, 'pack2'::character varying, 'pack3'::character varying, 'pack4'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_monthly_questions" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_monthly_questions" IS 'Tracks which questions users have selected for monthly performance monitoring using pack1-pack4 system';



CREATE TABLE IF NOT EXISTS "public"."user_monthly_schedule" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "first_schedule_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "next_test_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "package_tier" character varying(20) NOT NULL,
    "subscription_status" "text" DEFAULT 'active'::"text",
    "last_test_month" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_monthly_schedule_package_tier_check" CHECK ((("package_tier")::"text" = ANY ((ARRAY['pack1'::character varying, 'pack2'::character varying, 'pack3'::character varying, 'pack4'::character varying])::"text"[]))),
    CONSTRAINT "user_monthly_schedule_subscription_status_check" CHECK (("subscription_status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."user_monthly_schedule" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_monthly_schedule" IS 'Tracks user monthly testing schedule using pack1-pack4 system';



ALTER TABLE ONLY "public"."debug_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."debug_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."audiences"
    ADD CONSTRAINT "audiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batch_faq_pairs"
    ADD CONSTRAINT "batch_faq_pairs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_slugs"
    ADD CONSTRAINT "brand_slugs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_slugs"
    ADD CONSTRAINT "brand_slugs_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_configuration"
    ADD CONSTRAINT "client_configuration_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."client_configuration"
    ADD CONSTRAINT "client_configuration_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_organisation"
    ADD CONSTRAINT "client_organisation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_product_persona"
    ADD CONSTRAINT "client_product_persona_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."construct_faq_pairs"
    ADD CONSTRAINT "construct_faq_pairs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debug_log"
    ADD CONSTRAINT "debug_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."end_users"
    ADD CONSTRAINT "end_users_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."end_users"
    ADD CONSTRAINT "end_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."end_users"
    ADD CONSTRAINT "end_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."failed_invoices"
    ADD CONSTRAINT "failed_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faq_performance_logs"
    ADD CONSTRAINT "faq_performance_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."industries"
    ADD CONSTRAINT "industries_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."industries"
    ADD CONSTRAINT "industries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."llm_discovery_faq_objects"
    ADD CONSTRAINT "llm_discovery_faq_objects_batch_faq_pairs_id_unique" UNIQUE ("batch_faq_pairs_id");



COMMENT ON CONSTRAINT "llm_discovery_faq_objects_batch_faq_pairs_id_unique" ON "public"."llm_discovery_faq_objects" IS 'Ensures each batch_faq_pairs_id can only have one FAQ object, enabling upsert operations with onConflict';



ALTER TABLE ONLY "public"."llm_discovery_faq_objects"
    ADD CONSTRAINT "llm_discovery_faq_objects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."llm_discovery_static"
    ADD CONSTRAINT "llm_discovery_static_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."llm_discovery_static"
    ADD CONSTRAINT "llm_discovery_static_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."markets"
    ADD CONSTRAINT "markets_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."markets"
    ADD CONSTRAINT "markets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_slugs"
    ADD CONSTRAINT "organization_slugs_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."organization_slugs"
    ADD CONSTRAINT "organization_slugs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_slugs"
    ADD CONSTRAINT "organization_slugs_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_pkey" PRIMARY KEY ("tier");



ALTER TABLE ONLY "public"."product_slugs"
    ADD CONSTRAINT "product_slugs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_slugs"
    ADD CONSTRAINT "product_slugs_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_organisation_id_product_name_unique" UNIQUE ("organisation_id", "product_name");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_questions"
    ADD CONSTRAINT "review_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule"
    ADD CONSTRAINT "schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_webhook_log"
    ADD CONSTRAINT "stripe_webhook_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule"
    ADD CONSTRAINT "unique_batch_cluster_combo" UNIQUE ("unique_batch_cluster", "auth_user_id", "batch_date");



ALTER TABLE ONLY "public"."schedule"
    ADD CONSTRAINT "unique_batch_id" UNIQUE ("unique_batch_id");



ALTER TABLE ONLY "public"."user_monthly_llms"
    ADD CONSTRAINT "user_monthly_llms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_monthly_llms"
    ADD CONSTRAINT "user_monthly_llms_user_id_llm_provider_key" UNIQUE ("user_id", "llm_provider");



ALTER TABLE ONLY "public"."user_monthly_questions"
    ADD CONSTRAINT "user_monthly_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_monthly_questions"
    ADD CONSTRAINT "user_monthly_questions_user_id_question_id_key" UNIQUE ("user_id", "question_id");



ALTER TABLE ONLY "public"."user_monthly_schedule"
    ADD CONSTRAINT "user_monthly_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_monthly_schedule"
    ADD CONSTRAINT "user_monthly_schedule_user_id_key" UNIQUE ("user_id");



CREATE INDEX "idx_audiences_json_audience" ON "public"."audiences" USING "gin" ("json_audience");



CREATE INDEX "idx_audiences_target_audience" ON "public"."audiences" USING "btree" ("target_audience");



CREATE INDEX "idx_batch_faq_pairs_auth_user_id" ON "public"."batch_faq_pairs" USING "btree" ("auth_user_id");



CREATE INDEX "idx_batch_faq_pairs_batch_status" ON "public"."batch_faq_pairs" USING "btree" ("batch_status");



CREATE INDEX "idx_batch_faq_pairs_unique_batch_id" ON "public"."batch_faq_pairs" USING "btree" ("unique_batch_id");



CREATE INDEX "idx_brand_slugs_slug" ON "public"."brand_slugs" USING "btree" ("slug");



CREATE INDEX "idx_client_configuration_audience_id" ON "public"."client_configuration" USING "btree" ("audience_id");



CREATE INDEX "idx_client_configuration_auth_user_id" ON "public"."client_configuration" USING "btree" ("auth_user_id");



CREATE INDEX "idx_client_configuration_brand_id" ON "public"."client_configuration" USING "btree" ("brand_id");



CREATE INDEX "idx_client_configuration_market_id" ON "public"."client_configuration" USING "btree" ("market_id");



CREATE INDEX "idx_client_configuration_persona_id" ON "public"."client_configuration" USING "btree" ("persona_id");



CREATE INDEX "idx_client_configuration_product_id" ON "public"."client_configuration" USING "btree" ("product_id");



CREATE INDEX "idx_construct_faq_pairs_auth_user_id" ON "public"."construct_faq_pairs" USING "btree" ("auth_user_id");



CREATE INDEX "idx_construct_faq_pairs_unique_batch_id" ON "public"."construct_faq_pairs" USING "btree" ("unique_batch_id");



CREATE INDEX "idx_faq_performance_logs_ai_provider" ON "public"."faq_performance_logs" USING "btree" ("ai_provider");



CREATE INDEX "idx_faq_performance_logs_auth_user_id" ON "public"."faq_performance_logs" USING "btree" ("auth_user_id");



CREATE INDEX "idx_faq_performance_logs_claude_status" ON "public"."faq_performance_logs" USING "btree" ("claude_status");



CREATE INDEX "idx_faq_performance_logs_gemini_status" ON "public"."faq_performance_logs" USING "btree" ("gemini_status");



CREATE INDEX "idx_faq_performance_logs_openai_status" ON "public"."faq_performance_logs" USING "btree" ("openai_status");



CREATE INDEX "idx_faq_performance_logs_perplexity_status" ON "public"."faq_performance_logs" USING "btree" ("perplexity_status");



CREATE INDEX "idx_faq_performance_logs_question_id" ON "public"."faq_performance_logs" USING "btree" ("question_id");



CREATE INDEX "idx_faq_performance_logs_status" ON "public"."faq_performance_logs" USING "btree" ("status");



CREATE INDEX "idx_faq_performance_logs_test_date" ON "public"."faq_performance_logs" USING "btree" ("test_date");



CREATE INDEX "idx_faq_performance_logs_test_month" ON "public"."faq_performance_logs" USING "btree" ("test_month");



CREATE INDEX "idx_faq_performance_logs_tested_llms" ON "public"."faq_performance_logs" USING "gin" ("tested_llms");



CREATE INDEX "idx_invoices_sent_to_schedule" ON "public"."invoices" USING "btree" ("sent_to_schedule") WHERE ("sent_to_schedule" = false);



CREATE INDEX "idx_llm_discovery_faq_auth_user_id" ON "public"."llm_discovery_faq_objects" USING "btree" ("auth_user_id");



CREATE INDEX "idx_llm_discovery_faq_batch_id" ON "public"."llm_discovery_faq_objects" USING "btree" ("batch_faq_pairs_id");



CREATE INDEX "idx_llm_discovery_faq_brand_id" ON "public"."llm_discovery_faq_objects" USING "btree" ("brand_id");



CREATE INDEX "idx_llm_discovery_faq_org_id" ON "public"."llm_discovery_faq_objects" USING "btree" ("client_organisation_id");



CREATE INDEX "idx_llm_discovery_faq_product_id" ON "public"."llm_discovery_faq_objects" USING "btree" ("product_id");



CREATE INDEX "idx_llm_discovery_faq_week_start" ON "public"."llm_discovery_faq_objects" USING "btree" ("week_start_date");



CREATE INDEX "idx_llm_discovery_static_active" ON "public"."llm_discovery_static" USING "btree" ("is_active");



CREATE INDEX "idx_llm_discovery_static_auth_user_id" ON "public"."llm_discovery_static" USING "btree" ("auth_user_id");



CREATE INDEX "idx_llm_discovery_static_org_id" ON "public"."llm_discovery_static" USING "btree" ("client_organisation_id");



CREATE INDEX "idx_organization_slugs_slug" ON "public"."organization_slugs" USING "btree" ("slug");



CREATE INDEX "idx_product_slugs_slug" ON "public"."product_slugs" USING "btree" ("slug");



CREATE INDEX "idx_user_monthly_llms_active" ON "public"."user_monthly_llms" USING "btree" ("user_id") WHERE ("is_active" = true);



CREATE INDEX "idx_user_monthly_llms_package" ON "public"."user_monthly_llms" USING "btree" ("package_tier");



CREATE INDEX "idx_user_monthly_llms_user_id" ON "public"."user_monthly_llms" USING "btree" ("user_id");



CREATE INDEX "idx_user_monthly_questions_active" ON "public"."user_monthly_questions" USING "btree" ("user_id") WHERE ("is_active" = true);



CREATE INDEX "idx_user_monthly_questions_package" ON "public"."user_monthly_questions" USING "btree" ("package_tier");



CREATE INDEX "idx_user_monthly_questions_user_id" ON "public"."user_monthly_questions" USING "btree" ("user_id");



CREATE INDEX "idx_user_monthly_schedule_next_test" ON "public"."user_monthly_schedule" USING "btree" ("next_test_date") WHERE ("subscription_status" = 'active'::"text");



CREATE INDEX "idx_user_monthly_schedule_user_id" ON "public"."user_monthly_schedule" USING "btree" ("user_id");



CREATE INDEX "review_questions_answer_status_idx" ON "public"."review_questions" USING "btree" ("answer_status");



CREATE INDEX "review_questions_auth_user_id_idx" ON "public"."review_questions" USING "btree" ("auth_user_id");



CREATE INDEX "review_questions_created_at_idx" ON "public"."review_questions" USING "btree" ("created_at");



CREATE OR REPLACE TRIGGER "set_brand_jsonld_object" BEFORE INSERT OR UPDATE ON "public"."brands" FOR EACH ROW EXECUTE FUNCTION "public"."generate_brand_jsonld_object"();



CREATE OR REPLACE TRIGGER "set_organisation_jsonld_object" BEFORE INSERT OR UPDATE ON "public"."client_organisation" FOR EACH ROW EXECUTE FUNCTION "public"."generate_organisation_jsonld_object"();



CREATE OR REPLACE TRIGGER "set_product_schema_json" BEFORE INSERT OR UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."generate_product_schema_json"();



CREATE OR REPLACE TRIGGER "tr_process_stripe_webhook" AFTER INSERT ON "public"."stripe_webhook_log" FOR EACH ROW EXECUTE FUNCTION "public"."process_stripe_webhook"();



CREATE OR REPLACE TRIGGER "tr_set_billing_periods" BEFORE INSERT ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_billing_periods"();



CREATE OR REPLACE TRIGGER "tr_set_invoice_auth_user" BEFORE INSERT ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_invoice_auth_user"();



CREATE OR REPLACE TRIGGER "tr_split_questions_on_generation" AFTER UPDATE ON "public"."construct_faq_pairs" FOR EACH ROW WHEN ((("new"."question_status" = 'questions_generated'::"text") AND ("old"."question_status" IS DISTINCT FROM "new"."question_status"))) EXECUTE FUNCTION "public"."split_questions_into_review"();



CREATE OR REPLACE TRIGGER "trg_link_org" BEFORE INSERT ON "public"."end_users" FOR EACH ROW EXECUTE FUNCTION "public"."link_end_user_to_organisation"();



CREATE OR REPLACE TRIGGER "trg_link_org_to_user" AFTER INSERT ON "public"."client_organisation" FOR EACH ROW EXECUTE FUNCTION "public"."link_org_to_end_user"();



CREATE OR REPLACE TRIGGER "trg_populate_package_fields" BEFORE INSERT ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."populate_invoice_package_fields"();



CREATE OR REPLACE TRIGGER "trg_set_invoice_batches" BEFORE INSERT ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_invoice_batches"();



CREATE OR REPLACE TRIGGER "trg_sync_org_jsonld" AFTER INSERT OR UPDATE ON "public"."client_organisation" FOR EACH ROW EXECUTE FUNCTION "public"."sync_org_jsonld_to_config"();



CREATE OR REPLACE TRIGGER "trg_update_persona_jsonld" BEFORE INSERT OR UPDATE ON "public"."client_product_persona" FOR EACH ROW EXECUTE FUNCTION "public"."update_persona_jsonld"();



CREATE OR REPLACE TRIGGER "trg_update_persona_summary" BEFORE INSERT OR UPDATE ON "public"."client_product_persona" FOR EACH ROW EXECUTE FUNCTION "public"."update_persona_summary"();



CREATE OR REPLACE TRIGGER "update_audiences_updated_at" BEFORE UPDATE ON "public"."audiences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_brand_slugs_updated_at" BEFORE UPDATE ON "public"."brand_slugs" FOR EACH ROW EXECUTE FUNCTION "public"."update_llm_discovery_updated_at"();



CREATE OR REPLACE TRIGGER "update_llm_discovery_faq_objects_updated_at" BEFORE UPDATE ON "public"."llm_discovery_faq_objects" FOR EACH ROW EXECUTE FUNCTION "public"."update_llm_discovery_updated_at"();



CREATE OR REPLACE TRIGGER "update_llm_discovery_static_updated_at" BEFORE UPDATE ON "public"."llm_discovery_static" FOR EACH ROW EXECUTE FUNCTION "public"."update_llm_discovery_updated_at"();



CREATE OR REPLACE TRIGGER "update_organization_slugs_updated_at" BEFORE UPDATE ON "public"."organization_slugs" FOR EACH ROW EXECUTE FUNCTION "public"."update_llm_discovery_updated_at"();



CREATE OR REPLACE TRIGGER "update_product_slugs_updated_at" BEFORE UPDATE ON "public"."product_slugs" FOR EACH ROW EXECUTE FUNCTION "public"."update_llm_discovery_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_monthly_llms_updated_at" BEFORE UPDATE ON "public"."user_monthly_llms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_monthly_questions_updated_at" BEFORE UPDATE ON "public"."user_monthly_questions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_monthly_schedule_updated_at" BEFORE UPDATE ON "public"."user_monthly_schedule" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."audiences"
    ADD CONSTRAINT "audiences_detailed_audience_fkey" FOREIGN KEY ("detailed_audience") REFERENCES "storage"."objects"("id");



ALTER TABLE ONLY "public"."batch_faq_pairs"
    ADD CONSTRAINT "batch_faq_pairs_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."client_organisation"("id");



ALTER TABLE ONLY "public"."client_configuration"
    ADD CONSTRAINT "client_configuration_audience_id_fkey" FOREIGN KEY ("audience_id") REFERENCES "public"."audiences"("id");



ALTER TABLE ONLY "public"."client_configuration"
    ADD CONSTRAINT "client_configuration_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."client_configuration"
    ADD CONSTRAINT "client_configuration_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");



ALTER TABLE ONLY "public"."client_configuration"
    ADD CONSTRAINT "client_configuration_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id");



ALTER TABLE ONLY "public"."client_configuration"
    ADD CONSTRAINT "client_configuration_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."client_product_persona"("id");



ALTER TABLE ONLY "public"."client_configuration"
    ADD CONSTRAINT "client_configuration_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."end_users"
    ADD CONSTRAINT "end_users_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."faq_performance_logs"
    ADD CONSTRAINT "faq_performance_logs_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."faq_performance_logs"
    ADD CONSTRAINT "faq_performance_logs_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."review_questions"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."llm_discovery_faq_objects"
    ADD CONSTRAINT "llm_discovery_faq_objects_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."llm_discovery_faq_objects"
    ADD CONSTRAINT "llm_discovery_faq_objects_batch_faq_pairs_id_fkey" FOREIGN KEY ("batch_faq_pairs_id") REFERENCES "public"."batch_faq_pairs"("id");



ALTER TABLE ONLY "public"."llm_discovery_faq_objects"
    ADD CONSTRAINT "llm_discovery_faq_objects_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");



ALTER TABLE ONLY "public"."llm_discovery_faq_objects"
    ADD CONSTRAINT "llm_discovery_faq_objects_client_organisation_id_fkey" FOREIGN KEY ("client_organisation_id") REFERENCES "public"."client_organisation"("id");



ALTER TABLE ONLY "public"."llm_discovery_faq_objects"
    ADD CONSTRAINT "llm_discovery_faq_objects_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."llm_discovery_static"
    ADD CONSTRAINT "llm_discovery_static_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."llm_discovery_static"
    ADD CONSTRAINT "llm_discovery_static_client_organisation_id_fkey" FOREIGN KEY ("client_organisation_id") REFERENCES "public"."client_organisation"("id");



ALTER TABLE ONLY "public"."organization_slugs"
    ADD CONSTRAINT "organization_slugs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."client_organisation"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."client_organisation"("id");



ALTER TABLE ONLY "public"."schedule"
    ADD CONSTRAINT "schedule_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "public"."end_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule"
    ADD CONSTRAINT "schedule_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."client_organisation"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_industry_id_fkey" FOREIGN KEY ("industry_id") REFERENCES "public"."industries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_monthly_llms"
    ADD CONSTRAINT "user_monthly_llms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_monthly_questions"
    ADD CONSTRAINT "user_monthly_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."review_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_monthly_questions"
    ADD CONSTRAINT "user_monthly_questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_monthly_schedule"
    ADD CONSTRAINT "user_monthly_schedule_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow authenticated users to delete audiences" ON "public"."audiences" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to insert audiences" ON "public"."audiences" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated users to update audiences" ON "public"."audiences" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated users to view audiences" ON "public"."audiences" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow insert for authenticated users" ON "public"."end_users" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow insert to end_users by public" ON "public"."end_users" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public read access for organization slugs" ON "public"."organization_slugs" FOR SELECT USING (true);



CREATE POLICY "Service role can insert performance logs" ON "public"."faq_performance_logs" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can select performance logs" ON "public"."faq_performance_logs" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Users can access their own data" ON "public"."end_users" USING (("auth"."uid"() = "auth_user_id"));



CREATE POLICY "Users can delete their own monthly LLMs" ON "public"."user_monthly_llms" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own monthly questions" ON "public"."user_monthly_questions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own batch FAQ pairs" ON "public"."batch_faq_pairs" FOR INSERT WITH CHECK (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own monthly LLMs" ON "public"."user_monthly_llms" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own monthly questions" ON "public"."user_monthly_questions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own monthly schedule" ON "public"."user_monthly_schedule" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own performance logs" ON "public"."faq_performance_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "auth_user_id"));



CREATE POLICY "Users can insert their own review questions" ON "public"."review_questions" FOR INSERT WITH CHECK (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their brand slugs" ON "public"."brand_slugs" USING (("brand_id" IN ( SELECT "brands"."id"
   FROM "public"."brands"
  WHERE ("brands"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their organization slugs" ON "public"."organization_slugs" USING (("organization_id" IN ( SELECT "client_organisation"."id"
   FROM "public"."client_organisation"
  WHERE ("client_organisation"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "client_organisation"."id"
   FROM "public"."client_organisation"
  WHERE ("client_organisation"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their own FAQ discovery objects" ON "public"."llm_discovery_faq_objects" USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own static discovery objects" ON "public"."llm_discovery_static" USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their product slugs" ON "public"."product_slugs" USING (("product_id" IN ( SELECT "products"."id"
   FROM "public"."products"
  WHERE ("products"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own batch FAQ pairs" ON "public"."batch_faq_pairs" FOR UPDATE USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own monthly LLMs" ON "public"."user_monthly_llms" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own monthly questions" ON "public"."user_monthly_questions" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own monthly schedule" ON "public"."user_monthly_schedule" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own performance logs" ON "public"."faq_performance_logs" FOR UPDATE USING (("auth_user_id" = "auth"."uid"())) WITH CHECK (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own review questions" ON "public"."review_questions" FOR UPDATE USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own batch FAQ pairs" ON "public"."batch_faq_pairs" FOR SELECT USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own monthly LLMs" ON "public"."user_monthly_llms" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own monthly questions" ON "public"."user_monthly_questions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own monthly schedule" ON "public"."user_monthly_schedule" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own performance logs" ON "public"."faq_performance_logs" FOR SELECT USING (("auth"."uid"() = "auth_user_id"));



CREATE POLICY "Users can view their own review questions" ON "public"."review_questions" FOR SELECT USING (("auth_user_id" = "auth"."uid"()));



ALTER TABLE "public"."audiences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."batch_faq_pairs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_slugs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."end_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faq_performance_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."llm_discovery_faq_objects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."llm_discovery_static" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_slugs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_slugs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_monthly_llms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_monthly_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_monthly_schedule" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_auth_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_auth_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_auth_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."basic_test"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."basic_test"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."basic_test"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON PROCEDURE "public"."call_patch_auth_ids"() TO "anon";
GRANT ALL ON PROCEDURE "public"."call_patch_auth_ids"() TO "authenticated";
GRANT ALL ON PROCEDURE "public"."call_patch_auth_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_user_subscription_status"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_user_subscription_status"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_user_subscription_status"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."construct_answer_prompt"("faq_pair_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."construct_answer_prompt"("faq_pair_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."construct_answer_prompt"("faq_pair_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_subscription_raw"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."debug_subscription_raw"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_subscription_raw"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."format_ai_request"() TO "anon";
GRANT ALL ON FUNCTION "public"."format_ai_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."format_ai_request"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_ai_request_for_answers"("p_unique_batch_id" "text", "p_batch_faq_pairs" integer, "p_organisation" "text", "p_market_name" "text", "p_audience_name" "text", "p_persona_jsonld" "text", "p_product_jsonld_object" "text", "p_question" "text", "p_topic" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_ai_request_for_answers"("p_unique_batch_id" "text", "p_batch_faq_pairs" integer, "p_organisation" "text", "p_market_name" "text", "p_audience_name" "text", "p_persona_jsonld" "text", "p_product_jsonld_object" "text", "p_question" "text", "p_topic" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_ai_request_for_answers"("p_unique_batch_id" "text", "p_batch_faq_pairs" integer, "p_organisation" "text", "p_market_name" "text", "p_audience_name" "text", "p_persona_jsonld" "text", "p_product_jsonld_object" "text", "p_question" "text", "p_topic" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_brand_jsonld_object"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_brand_jsonld_object"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_brand_jsonld_object"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_brand_slug"("brand_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_brand_slug"("brand_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_brand_slug"("brand_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_organisation_jsonld_object"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_organisation_jsonld_object"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_organisation_jsonld_object"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_organization_index"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_organization_index"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_organization_index"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_organization_jsonld"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_organization_jsonld"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_organization_jsonld"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_organization_slug"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_organization_slug"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_organization_slug"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_platform_index"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_platform_index"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_platform_index"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_product_schema_json"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_product_schema_json"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_product_schema_json"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_product_slug"("product_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_product_slug"("product_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_product_slug"("product_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_slug"("input_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_slug"("input_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_slug"("input_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_package_limits"("package_tier" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."get_package_limits"("package_tier" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_package_limits"("package_tier" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_package_limits_backup"("pack_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."get_package_limits_backup"("pack_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_package_limits_backup"("pack_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_organization_slug_safe"("p_organization_id" "uuid", "p_slug" "text", "p_organization_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_organization_slug_safe"("p_organization_id" "uuid", "p_slug" "text", "p_organization_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_organization_slug_safe"("p_organization_id" "uuid", "p_slug" "text", "p_organization_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_stripe_invoice"("p_email" "text", "p_amount_cents" integer, "p_amount_gbp" numeric, "p_paid_at" timestamp with time zone, "p_hosted_invoice_url" "text", "p_invoice_pdf_url" "text", "p_status" "text", "p_package_tier" "text", "p_faq_pairs_pm" integer, "p_faq_per_batch" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."insert_stripe_invoice"("p_email" "text", "p_amount_cents" integer, "p_amount_gbp" numeric, "p_paid_at" timestamp with time zone, "p_hosted_invoice_url" "text", "p_invoice_pdf_url" "text", "p_status" "text", "p_package_tier" "text", "p_faq_pairs_pm" integer, "p_faq_per_batch" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_stripe_invoice"("p_email" "text", "p_amount_cents" integer, "p_amount_gbp" numeric, "p_paid_at" timestamp with time zone, "p_hosted_invoice_url" "text", "p_invoice_pdf_url" "text", "p_status" "text", "p_package_tier" "text", "p_faq_pairs_pm" integer, "p_faq_per_batch" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_stripe_invoice"("p_email" "text", "p_amount_cents" bigint, "p_amount_gbp" numeric, "p_paid_at" timestamp with time zone, "p_hosted_invoice_url" "text", "p_invoice_pdf_url" "text", "p_status" "text", "p_package_tier" "text", "p_faq_pairs_pm" integer, "p_faq_per_batch" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."insert_stripe_invoice"("p_email" "text", "p_amount_cents" bigint, "p_amount_gbp" numeric, "p_paid_at" timestamp with time zone, "p_hosted_invoice_url" "text", "p_invoice_pdf_url" "text", "p_status" "text", "p_package_tier" "text", "p_faq_pairs_pm" integer, "p_faq_per_batch" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_stripe_invoice"("p_email" "text", "p_amount_cents" bigint, "p_amount_gbp" numeric, "p_paid_at" timestamp with time zone, "p_hosted_invoice_url" "text", "p_invoice_pdf_url" "text", "p_status" "text", "p_package_tier" "text", "p_faq_pairs_pm" integer, "p_faq_per_batch" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."link_end_user_to_organisation"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_end_user_to_organisation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_end_user_to_organisation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."link_org_to_end_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_org_to_end_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_org_to_end_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."match_user_email"("email_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."match_user_email"("email_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_user_email"("email_input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."patch_auth_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."patch_auth_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."patch_auth_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."patch_auth_user_id_on_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."patch_auth_user_id_on_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."patch_auth_user_id_on_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_invoice_package_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."populate_invoice_package_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_invoice_package_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_stripe_webhook"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_stripe_webhook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_stripe_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_webhook"("stripe_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."process_webhook"("stripe_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_webhook"("stripe_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_auth_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_auth_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_auth_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_billing_periods"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_billing_periods"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_billing_periods"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_invoice_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_invoice_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_invoice_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_invoice_batches"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_invoice_batches"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_invoice_batches"() TO "service_role";



GRANT ALL ON FUNCTION "public"."simple_test"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."simple_test"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."simple_test"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."split_questions_into_review"() TO "anon";
GRANT ALL ON FUNCTION "public"."split_questions_into_review"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."split_questions_into_review"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_org_jsonld_to_config"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_org_jsonld_to_config"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_org_jsonld_to_config"() TO "service_role";



GRANT ALL ON FUNCTION "public"."test_invoice_lookup"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."test_invoice_lookup"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_invoice_lookup"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."test_simple_lookup"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."test_simple_lookup"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_simple_lookup"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."test_subscription_debug"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."test_subscription_debug"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_subscription_debug"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_generate_organization_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_generate_organization_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_generate_organization_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_llm_discovery_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_llm_discovery_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_llm_discovery_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_persona_jsonld"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_persona_jsonld"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_persona_jsonld"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_persona_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_persona_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_persona_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."audiences" TO "anon";
GRANT ALL ON TABLE "public"."audiences" TO "authenticated";
GRANT ALL ON TABLE "public"."audiences" TO "service_role";



GRANT ALL ON TABLE "public"."batch_faq_pairs" TO "anon";
GRANT ALL ON TABLE "public"."batch_faq_pairs" TO "authenticated";
GRANT ALL ON TABLE "public"."batch_faq_pairs" TO "service_role";



GRANT ALL ON TABLE "public"."brand_slugs" TO "anon";
GRANT ALL ON TABLE "public"."brand_slugs" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_slugs" TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON TABLE "public"."client_configuration" TO "anon";
GRANT ALL ON TABLE "public"."client_configuration" TO "authenticated";
GRANT ALL ON TABLE "public"."client_configuration" TO "service_role";



GRANT ALL ON TABLE "public"."client_organisation" TO "anon";
GRANT ALL ON TABLE "public"."client_organisation" TO "authenticated";
GRANT ALL ON TABLE "public"."client_organisation" TO "service_role";



GRANT ALL ON TABLE "public"."client_product_persona" TO "anon";
GRANT ALL ON TABLE "public"."client_product_persona" TO "authenticated";
GRANT ALL ON TABLE "public"."client_product_persona" TO "service_role";



GRANT ALL ON TABLE "public"."construct_faq_pairs" TO "anon";
GRANT ALL ON TABLE "public"."construct_faq_pairs" TO "authenticated";
GRANT ALL ON TABLE "public"."construct_faq_pairs" TO "service_role";



GRANT ALL ON TABLE "public"."debug_log" TO "anon";
GRANT ALL ON TABLE "public"."debug_log" TO "authenticated";
GRANT ALL ON TABLE "public"."debug_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."debug_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."debug_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."debug_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."end_users" TO "anon";
GRANT ALL ON TABLE "public"."end_users" TO "authenticated";
GRANT ALL ON TABLE "public"."end_users" TO "service_role";



GRANT ALL ON TABLE "public"."failed_invoices" TO "anon";
GRANT ALL ON TABLE "public"."failed_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."failed_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."faq_performance_logs" TO "anon";
GRANT ALL ON TABLE "public"."faq_performance_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."faq_performance_logs" TO "service_role";



GRANT ALL ON TABLE "public"."industries" TO "anon";
GRANT ALL ON TABLE "public"."industries" TO "authenticated";
GRANT ALL ON TABLE "public"."industries" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."llm_discovery_faq_objects" TO "anon";
GRANT ALL ON TABLE "public"."llm_discovery_faq_objects" TO "authenticated";
GRANT ALL ON TABLE "public"."llm_discovery_faq_objects" TO "service_role";



GRANT ALL ON TABLE "public"."llm_discovery_static" TO "anon";
GRANT ALL ON TABLE "public"."llm_discovery_static" TO "authenticated";
GRANT ALL ON TABLE "public"."llm_discovery_static" TO "service_role";



GRANT ALL ON TABLE "public"."markets" TO "anon";
GRANT ALL ON TABLE "public"."markets" TO "authenticated";
GRANT ALL ON TABLE "public"."markets" TO "service_role";



GRANT ALL ON TABLE "public"."organization_slugs" TO "anon";
GRANT ALL ON TABLE "public"."organization_slugs" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_slugs" TO "service_role";



GRANT ALL ON TABLE "public"."packages" TO "anon";
GRANT ALL ON TABLE "public"."packages" TO "authenticated";
GRANT ALL ON TABLE "public"."packages" TO "service_role";



GRANT ALL ON TABLE "public"."product_slugs" TO "anon";
GRANT ALL ON TABLE "public"."product_slugs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_slugs" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."review_questions" TO "anon";
GRANT ALL ON TABLE "public"."review_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."review_questions" TO "service_role";



GRANT ALL ON TABLE "public"."schedule" TO "anon";
GRANT ALL ON TABLE "public"."schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_sandbox" TO "anon";
GRANT ALL ON TABLE "public"."stripe_sandbox" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_sandbox" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_webhook_log" TO "anon";
GRANT ALL ON TABLE "public"."stripe_webhook_log" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_webhook_log" TO "service_role";



GRANT ALL ON TABLE "public"."subcategories" TO "anon";
GRANT ALL ON TABLE "public"."subcategories" TO "authenticated";
GRANT ALL ON TABLE "public"."subcategories" TO "service_role";



GRANT ALL ON TABLE "public"."user_monthly_llms" TO "anon";
GRANT ALL ON TABLE "public"."user_monthly_llms" TO "authenticated";
GRANT ALL ON TABLE "public"."user_monthly_llms" TO "service_role";



GRANT ALL ON TABLE "public"."user_monthly_questions" TO "anon";
GRANT ALL ON TABLE "public"."user_monthly_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_monthly_questions" TO "service_role";



GRANT ALL ON TABLE "public"."user_monthly_schedule" TO "anon";
GRANT ALL ON TABLE "public"."user_monthly_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."user_monthly_schedule" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






RESET ALL;
