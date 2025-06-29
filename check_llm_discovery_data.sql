-- Check current state of LLM discovery tables
-- This will help us understand what data is present and what's missing

-- 1. Check llm_discovery_static table
SELECT 
    'llm_discovery_static' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN organization_jsonld IS NOT NULL THEN 1 END) as with_org_jsonld,
    COUNT(CASE WHEN brand_jsonld IS NOT NULL THEN 1 END) as with_brand_jsonld,
    COUNT(CASE WHEN product_jsonld IS NOT NULL THEN 1 END) as with_product_jsonld,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_records
FROM llm_discovery_static;

-- 2. Check llm_discovery_faq_objects table
SELECT 
    'llm_discovery_faq_objects' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN faq_json_object IS NOT NULL THEN 1 END) as with_faq_json,
    COUNT(CASE WHEN organization_jsonld IS NOT NULL THEN 1 END) as with_org_jsonld,
    COUNT(CASE WHEN brand_jsonld IS NOT NULL THEN 1 END) as with_brand_jsonld,
    COUNT(CASE WHEN product_jsonld IS NOT NULL THEN 1 END) as with_product_jsonld
FROM llm_discovery_faq_objects;

-- 3. Show sample static object data
SELECT 
    'Static Objects Sample' as check_type,
    id,
    auth_user_id,
    client_organisation_id,
    CASE 
        WHEN organization_jsonld IS NOT NULL THEN '✅ Has Org JSON-LD'
        ELSE '❌ No Org JSON-LD'
    END as org_status,
    CASE 
        WHEN brand_jsonld IS NOT NULL THEN '✅ Has Brand JSON-LD'
        ELSE '❌ No Brand JSON-LD'
    END as brand_status,
    CASE 
        WHEN product_jsonld IS NOT NULL THEN '✅ Has Product JSON-LD'
        ELSE '❌ No Product JSON-LD'
    END as product_status,
    is_active,
    last_generated,
    created_at
FROM llm_discovery_static
ORDER BY created_at DESC
LIMIT 5;

-- 4. Show sample FAQ object data
SELECT 
    'FAQ Objects Sample' as check_type,
    id,
    batch_faq_pairs_id,
    auth_user_id,
    client_organisation_id,
    week_start_date,
    CASE 
        WHEN faq_json_object IS NOT NULL THEN '✅ Has FAQ JSON'
        ELSE '❌ No FAQ JSON'
    END as faq_status,
    CASE 
        WHEN organization_jsonld IS NOT NULL THEN '✅ Has Org JSON-LD'
        ELSE '❌ No Org JSON-LD'
    END as org_status,
    CASE 
        WHEN brand_jsonld IS NOT NULL THEN '✅ Has Brand JSON-LD'
        ELSE '❌ No Brand JSON-LD'
    END as brand_status,
    CASE 
        WHEN product_jsonld IS NOT NULL THEN '✅ Has Product JSON-LD'
        ELSE '❌ No Product JSON-LD'
    END as product_status,
    last_generated,
    created_at
FROM llm_discovery_faq_objects
ORDER BY created_at DESC
LIMIT 5;

-- 5. Check source data availability for products
SELECT 
    'Source Data Check' as check_type,
    'client_configuration' as source_table,
    COUNT(*) as total_records,
    COUNT(CASE WHEN schema_json IS NOT NULL THEN 1 END) as with_schema_json,
    COUNT(CASE WHEN product_name IS NOT NULL THEN 1 END) as with_product_name
FROM client_configuration;

-- 6. Check products table
SELECT 
    'products table' as source_table,
    COUNT(*) as total_records,
    COUNT(CASE WHEN schema_json IS NOT NULL THEN 1 END) as with_schema_json,
    COUNT(CASE WHEN product_name IS NOT NULL THEN 1 END) as with_product_name
FROM products;

-- 7. Check batch_faq_pairs for FAQ data
SELECT 
    'batch_faq_pairs' as source_table,
    COUNT(*) as total_records,
    COUNT(CASE WHEN faq_pairs_object IS NOT NULL THEN 1 END) as with_faq_pairs_object,
    COUNT(CASE WHEN auth_user_id IS NOT NULL THEN 1 END) as with_auth_user_id
FROM batch_faq_pairs; 