-- Fix FAQ Product Relationships
-- This script will populate the missing product_id in llm_discovery_faq_objects table

-- 1. First, let's see the current state
SELECT 
    'Current FAQ Objects State' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN product_id IS NOT NULL THEN 1 END) as with_product_id,
    COUNT(CASE WHEN product_id IS NULL THEN 1 END) as without_product_id,
    COUNT(CASE WHEN brand_id IS NOT NULL THEN 1 END) as with_brand_id,
    COUNT(CASE WHEN brand_id IS NULL THEN 1 END) as without_brand_id
FROM llm_discovery_faq_objects;

-- 2. Show sample records with missing product_id
SELECT 
    'Sample Records with Missing product_id' as check_type,
    id,
    batch_faq_pairs_id,
    auth_user_id,
    client_organisation_id,
    brand_id,
    product_id,
    week_start_date,
    created_at
FROM llm_discovery_faq_objects
WHERE product_id IS NULL
ORDER BY created_at DESC
LIMIT 5;

-- 3. Try to link FAQ objects to products via batch_faq_pairs
-- First, let's see what data we have in batch_faq_pairs
SELECT 
    'batch_faq_pairs data' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN auth_user_id IS NOT NULL THEN 1 END) as with_auth_user_id,
    COUNT(CASE WHEN faq_pairs_object IS NOT NULL THEN 1 END) as with_faq_pairs_object
FROM batch_faq_pairs;

-- 4. Update product_id using client_configuration data
UPDATE llm_discovery_faq_objects 
SET 
    product_id = cc.product_id,
    last_generated = NOW(),
    updated_at = NOW()
FROM client_configuration cc
WHERE llm_discovery_faq_objects.auth_user_id = cc.auth_user_id
  AND llm_discovery_faq_objects.product_id IS NULL
  AND cc.product_id IS NOT NULL;

-- 5. Also try to link via brands if we have brand_id
UPDATE llm_discovery_faq_objects 
SET 
    product_id = p.id,
    last_generated = NOW(),
    updated_at = NOW()
FROM products p
WHERE llm_discovery_faq_objects.brand_id = p.brand_id
  AND llm_discovery_faq_objects.product_id IS NULL
  AND p.id IS NOT NULL;

-- 6. Try to link via client_organisation_id to products
UPDATE llm_discovery_faq_objects 
SET 
    product_id = p.id,
    last_generated = NOW(),
    updated_at = NOW()
FROM products p
JOIN client_organisation co ON co.id = p.organisation_id
WHERE llm_discovery_faq_objects.client_organisation_id = co.id
  AND llm_discovery_faq_objects.product_id IS NULL
  AND p.id IS NOT NULL;

-- 7. Verify the updates worked
SELECT 
    'After Update - FAQ Objects' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN product_id IS NOT NULL THEN 1 END) as with_product_id,
    COUNT(CASE WHEN product_id IS NULL THEN 1 END) as without_product_id,
    COUNT(CASE WHEN brand_id IS NOT NULL THEN 1 END) as with_brand_id,
    COUNT(CASE WHEN brand_id IS NULL THEN 1 END) as without_brand_id
FROM llm_discovery_faq_objects;

-- 8. Show sample updated records
SELECT 
    'Updated Records Sample' as check_type,
    id,
    batch_faq_pairs_id,
    auth_user_id,
    client_organisation_id,
    brand_id,
    product_id,
    week_start_date,
    last_generated
FROM llm_discovery_faq_objects
WHERE product_id IS NOT NULL
ORDER BY last_generated DESC
LIMIT 5; 