-- Debug FAQ Objects Population Issues
-- This will help us understand why the FAQ objects aren't being written to llm_discovery_faq_objects

-- 0. First, check what columns actually exist in batch_faq_pairs
SELECT 
    'batch_faq_pairs columns' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'batch_faq_pairs'
ORDER BY ordinal_position;

-- 1. Check if batch_faq_pairs table has data
SELECT 
    'batch_faq_pairs' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN auth_user_id IS NOT NULL THEN 1 END) as with_auth_user_id,
    COUNT(CASE WHEN faq_pairs_object IS NOT NULL THEN 1 END) as with_faq_pairs_object,
    COUNT(CASE WHEN faq_pairs_object IS NOT NULL AND jsonb_typeof(faq_pairs_object) = 'object' THEN 1 END) as valid_faq_pairs_object
FROM batch_faq_pairs;

-- 2. Show sample batch_faq_pairs data (using only columns that exist)
SELECT 
    'batch_faq_pairs sample' as source,
    id,
    unique_batch_id,
    batch_date,
    organisation,
    brand,
    product,
    audience,
    auth_user_id,
    CASE 
        WHEN faq_pairs_object IS NOT NULL THEN jsonb_typeof(faq_pairs_object)
        ELSE 'NULL'
    END as faq_pairs_type,
    created_at
FROM batch_faq_pairs 
WHERE faq_pairs_object IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check what's in llm_discovery_faq_objects
SELECT 
    'llm_discovery_faq_objects' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN auth_user_id IS NOT NULL THEN 1 END) as with_auth_user_id,
    COUNT(CASE WHEN batch_faq_pairs_id IS NOT NULL THEN 1 END) as with_batch_id,
    COUNT(CASE WHEN faq_json_object IS NOT NULL THEN 1 END) as with_faq_json
FROM llm_discovery_faq_objects;

-- 4. Show sample llm_discovery_faq_objects data
SELECT 
    'llm_discovery_faq_objects sample' as source,
    id,
    batch_faq_pairs_id,
    auth_user_id,
    client_organisation_id,
    week_start_date,
    CASE 
        WHEN faq_json_object IS NOT NULL THEN jsonb_typeof(faq_json_object)
        ELSE 'NULL'
    END as faq_json_type,
    created_at
FROM llm_discovery_faq_objects
ORDER BY created_at DESC
LIMIT 5;

-- 5. Check for missing relationships
SELECT 
    'Missing Relationships' as check_type,
    COUNT(b.id) as batch_faq_pairs_count,
    COUNT(f.id) as faq_objects_count,
    COUNT(b.id) - COUNT(f.id) as missing_faq_objects
FROM batch_faq_pairs b
LEFT JOIN llm_discovery_faq_objects f ON b.id = f.batch_faq_pairs_id
WHERE b.faq_pairs_object IS NOT NULL;

-- 6. Show specific missing FAQ objects
SELECT 
    'Missing FAQ Objects' as check_type,
    b.id as batch_id,
    b.unique_batch_id,
    b.batch_date,
    b.organisation,
    b.brand,
    b.product,
    b.audience,
    b.auth_user_id,
    b.created_at as batch_created,
    f.id as faq_object_id,
    f.created_at as faq_object_created
FROM batch_faq_pairs b
LEFT JOIN llm_discovery_faq_objects f ON b.id = f.batch_faq_pairs_id
WHERE b.faq_pairs_object IS NOT NULL 
  AND f.id IS NULL
ORDER BY b.created_at DESC;

-- 7. Check if there are any auth_user_id mismatches
SELECT 
    'Auth User ID Check' as check_type,
    b.auth_user_id as batch_auth_user_id,
    f.auth_user_id as faq_object_auth_user_id,
    COUNT(*) as count
FROM batch_faq_pairs b
LEFT JOIN llm_discovery_faq_objects f ON b.id = f.batch_faq_pairs_id
WHERE b.faq_pairs_object IS NOT NULL
GROUP BY b.auth_user_id, f.auth_user_id;

-- 8. Check for any constraint violations
SELECT 
    'Constraint Check' as check_type,
    'batch_faq_pairs_id foreign key' as constraint_name,
    COUNT(*) as records_with_invalid_batch_id
FROM llm_discovery_faq_objects f
LEFT JOIN batch_faq_pairs b ON f.batch_faq_pairs_id = b.id
WHERE b.id IS NULL;

-- 9. Check RLS policies
SELECT 
    'RLS Policy Check' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('batch_faq_pairs', 'llm_discovery_faq_objects')
ORDER BY tablename, policyname;

-- 10. Test data insertion manually for a specific batch
-- Replace 'your-batch-id-here' with an actual batch ID from step 6
SELECT 
    'Manual Insert Test Data' as check_type,
    b.id as batch_id,
    b.auth_user_id,
    b.faq_pairs_object,
    CASE 
        WHEN b.faq_pairs_object IS NOT NULL THEN 'Ready for insert'
        ELSE 'Missing faq_pairs_object'
    END as status
FROM batch_faq_pairs b
WHERE b.faq_pairs_object IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM llm_discovery_faq_objects f 
      WHERE f.batch_faq_pairs_id = b.id
  )
LIMIT 1; 