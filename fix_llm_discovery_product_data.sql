-- Fix LLM Discovery Product Data
-- This script will populate the missing product_jsonld data in the LLM discovery tables

-- 1. First, let's see what product data we have available
SELECT 
    'Available Product Data' as check_type,
    'client_configuration' as source,
    COUNT(*) as total_records,
    COUNT(CASE WHEN schema_json IS NOT NULL THEN 1 END) as with_schema_json,
    COUNT(CASE WHEN product_name IS NOT NULL THEN 1 END) as with_product_name
FROM client_configuration
WHERE schema_json IS NOT NULL OR product_name IS NOT NULL;

-- 2. Update llm_discovery_static with product data from client_configuration
UPDATE llm_discovery_static 
SET 
    product_jsonld = cc.schema_json::jsonb,
    last_generated = NOW(),
    updated_at = NOW()
FROM client_configuration cc
WHERE llm_discovery_static.auth_user_id = cc.auth_user_id
  AND llm_discovery_static.product_jsonld IS NULL
  AND cc.schema_json IS NOT NULL;

-- 3. Update llm_discovery_faq_objects with product data
UPDATE llm_discovery_faq_objects 
SET 
    product_jsonld = cc.schema_json::jsonb,
    last_generated = NOW(),
    updated_at = NOW()
FROM client_configuration cc
WHERE llm_discovery_faq_objects.auth_user_id = cc.auth_user_id
  AND llm_discovery_faq_objects.product_jsonld IS NULL
  AND cc.schema_json IS NOT NULL;

-- 4. Also try to get product data from the products table if available
UPDATE llm_discovery_static 
SET 
    product_jsonld = p.schema_json::jsonb,
    last_generated = NOW(),
    updated_at = NOW()
FROM products p
JOIN client_organisation co ON co.id = p.organisation_id
WHERE llm_discovery_static.client_organisation_id = co.id
  AND llm_discovery_static.product_jsonld IS NULL
  AND p.schema_json IS NOT NULL;

-- 5. Update FAQ objects with product data from products table
UPDATE llm_discovery_faq_objects 
SET 
    product_jsonld = p.schema_json::jsonb,
    last_generated = NOW(),
    updated_at = NOW()
FROM products p
JOIN client_organisation co ON co.id = p.organisation_id
WHERE llm_discovery_faq_objects.client_organisation_id = co.id
  AND llm_discovery_faq_objects.product_jsonld IS NULL
  AND p.schema_json IS NOT NULL;

-- 6. Verify the updates worked
SELECT 
    'After Update - Static Objects' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN organization_jsonld IS NOT NULL THEN 1 END) as with_org_jsonld,
    COUNT(CASE WHEN brand_jsonld IS NOT NULL THEN 1 END) as with_brand_jsonld,
    COUNT(CASE WHEN product_jsonld IS NOT NULL THEN 1 END) as with_product_jsonld
FROM llm_discovery_static;

SELECT 
    'After Update - FAQ Objects' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN faq_json_object IS NOT NULL THEN 1 END) as with_faq_json,
    COUNT(CASE WHEN organization_jsonld IS NOT NULL THEN 1 END) as with_org_jsonld,
    COUNT(CASE WHEN brand_jsonld IS NOT NULL THEN 1 END) as with_brand_jsonld,
    COUNT(CASE WHEN product_jsonld IS NOT NULL THEN 1 END) as with_product_jsonld
FROM llm_discovery_faq_objects;

-- 7. Show sample updated data
SELECT 
    'Updated Static Objects Sample' as check_type,
    id,
    auth_user_id,
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
    last_generated
FROM llm_discovery_static
ORDER BY last_generated DESC
LIMIT 3; 