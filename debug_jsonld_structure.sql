-- Debug JSON-LD Structure Issues
-- This will help us understand why the JSON-LD quality check is failing

-- 1. Check what's actually in the source tables
SELECT 
    'client_organisation' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN organisation_jsonld_object IS NOT NULL THEN 1 END) as with_jsonld,
    COUNT(CASE WHEN organisation_jsonld_object IS NOT NULL AND jsonb_typeof(organisation_jsonld_object) = 'object' THEN 1 END) as valid_jsonld
FROM client_organisation;

SELECT 
    'brands' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN brand_jsonld_object IS NOT NULL THEN 1 END) as with_jsonld,
    COUNT(CASE WHEN brand_jsonld_object IS NOT NULL AND jsonb_typeof(brand_jsonld_object) = 'object' THEN 1 END) as valid_jsonld
FROM brands;

SELECT 
    'products' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN schema_json IS NOT NULL THEN 1 END) as with_jsonld,
    COUNT(CASE WHEN schema_json IS NOT NULL AND jsonb_typeof(schema_json) = 'object' THEN 1 END) as valid_jsonld
FROM products;

-- 2. Show sample data from source tables
SELECT 
    'client_organisation sample' as source,
    id,
    organisation_name,
    organisation_jsonld_object,
    CASE 
        WHEN organisation_jsonld_object IS NOT NULL THEN jsonb_typeof(organisation_jsonld_object)
        ELSE 'NULL'
    END as jsonld_type
FROM client_organisation 
WHERE organisation_jsonld_object IS NOT NULL
LIMIT 3;

SELECT 
    'brands sample' as source,
    id,
    brand_name,
    brand_jsonld_object,
    CASE 
        WHEN brand_jsonld_object IS NOT NULL THEN jsonb_typeof(brand_jsonld_object)
        ELSE 'NULL'
    END as jsonld_type
FROM brands 
WHERE brand_jsonld_object IS NOT NULL
LIMIT 3;

SELECT 
    'products sample' as source,
    id,
    product_name,
    schema_json,
    CASE 
        WHEN schema_json IS NOT NULL THEN jsonb_typeof(schema_json)
        ELSE 'NULL'
    END as jsonld_type
FROM products 
WHERE schema_json IS NOT NULL
LIMIT 3;

-- 3. Check what's in the LLM discovery tables
SELECT 
    'llm_discovery_static' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN organization_jsonld IS NOT NULL THEN 1 END) as with_org_jsonld,
    COUNT(CASE WHEN brand_jsonld IS NOT NULL THEN 1 END) as with_brand_jsonld,
    COUNT(CASE WHEN product_jsonld IS NOT NULL THEN 1 END) as with_product_jsonld
FROM llm_discovery_static;

-- 4. Show sample data from LLM discovery tables
SELECT 
    'llm_discovery_static sample' as source,
    id,
    organization_jsonld,
    brand_jsonld,
    product_jsonld,
    CASE 
        WHEN organization_jsonld IS NOT NULL THEN jsonb_typeof(organization_jsonld)
        ELSE 'NULL'
    END as org_jsonld_type,
    CASE 
        WHEN brand_jsonld IS NOT NULL THEN jsonb_typeof(brand_jsonld)
        ELSE 'NULL'
    END as brand_jsonld_type,
    CASE 
        WHEN product_jsonld IS NOT NULL THEN jsonb_typeof(product_jsonld)
        ELSE 'NULL'
    END as product_jsonld_type
FROM llm_discovery_static
LIMIT 3;

-- 5. Check if the data types match between source and destination
SELECT 
    'Data Type Comparison' as check_type,
    'client_organisation.organisation_jsonld_object' as source_column,
    data_type as source_type
FROM information_schema.columns 
WHERE table_name = 'client_organisation' AND column_name = 'organisation_jsonld_object'
UNION ALL
SELECT 
    'Data Type Comparison' as check_type,
    'llm_discovery_static.organization_jsonld' as dest_column,
    data_type as dest_type
FROM information_schema.columns 
WHERE table_name = 'llm_discovery_static' AND column_name = 'organization_jsonld';

-- 6. Check for any string vs JSONB conversion issues
SELECT 
    'String vs JSONB Check' as check_type,
    COUNT(CASE WHEN organisation_jsonld_object IS NOT NULL AND jsonb_typeof(organisation_jsonld_object) = 'string' THEN 1 END) as string_jsonld,
    COUNT(CASE WHEN organisation_jsonld_object IS NOT NULL AND jsonb_typeof(organisation_jsonld_object) = 'object' THEN 1 END) as object_jsonld
FROM client_organisation
WHERE organisation_jsonld_object IS NOT NULL; 