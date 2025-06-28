-- Test LLM Discovery Backend Data Population
-- This script verifies that the frontend construction page successfully wrote data to the backend tables

-- 1. Check if llm_discovery_static table has data
SELECT 
    'Static Objects Table' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN organization_jsonld IS NOT NULL THEN 1 END) as with_org_jsonld,
    COUNT(CASE WHEN brand_jsonld IS NOT NULL THEN 1 END) as with_brand_jsonld,
    COUNT(CASE WHEN product_jsonld IS NOT NULL THEN 1 END) as with_product_jsonld,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_records
FROM llm_discovery_static;

-- 2. Check if llm_discovery_faq_objects table has data
SELECT 
    'FAQ Objects Table' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN faq_json_object IS NOT NULL THEN 1 END) as with_faq_json,
    COUNT(CASE WHEN organization_jsonld IS NOT NULL THEN 1 END) as with_org_jsonld,
    COUNT(CASE WHEN brand_jsonld IS NOT NULL THEN 1 END) as with_brand_jsonld,
    COUNT(CASE WHEN product_jsonld IS NOT NULL THEN 1 END) as with_product_jsonld
FROM llm_discovery_faq_objects;

-- 3. Show sample static object data
SELECT 
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
    last_generated,
    created_at
FROM llm_discovery_faq_objects
ORDER BY created_at DESC
LIMIT 5;

-- 5. Test the platform index generation function
SELECT 
    'Platform Index Test' as test_name,
    CASE 
        WHEN generate_platform_index() IS NOT NULL THEN '✅ Function works'
        ELSE '❌ Function failed'
    END as status;

-- 6. Test organization index generation for a specific user
SELECT 
    'Organization Index Test' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM llm_discovery_static 
            WHERE auth_user_id = (SELECT id FROM auth.users LIMIT 1)
        ) THEN '✅ Has data to test with'
        ELSE '❌ No data available'
    END as status;

-- 7. Check data relationships
SELECT 
    'Data Relationships' as check_type,
    COUNT(DISTINCT s.auth_user_id) as unique_users_with_static,
    COUNT(DISTINCT f.auth_user_id) as unique_users_with_faq,
    COUNT(DISTINCT s.client_organisation_id) as unique_organizations,
    COUNT(f.id) as total_faq_objects
FROM llm_discovery_static s
LEFT JOIN llm_discovery_faq_objects f ON s.auth_user_id = f.auth_user_id;

-- 8. Verify JSON-LD structure quality
SELECT 
    'JSON-LD Quality Check' as check_type,
    COUNT(CASE WHEN organization_jsonld IS NOT NULL AND jsonb_typeof(organization_jsonld) = 'object' THEN 1 END) as valid_org_jsonld,
    COUNT(CASE WHEN brand_jsonld IS NOT NULL AND jsonb_typeof(brand_jsonld) = 'object' THEN 1 END) as valid_brand_jsonld,
    COUNT(CASE WHEN product_jsonld IS NOT NULL AND jsonb_typeof(product_jsonld) = 'object' THEN 1 END) as valid_product_jsonld
FROM llm_discovery_static
WHERE organization_jsonld IS NOT NULL OR brand_jsonld IS NOT NULL OR product_jsonld IS NOT NULL; 