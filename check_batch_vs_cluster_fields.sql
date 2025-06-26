-- Check the difference between cluster total and batch specific fields
-- We need to understand which field represents the actual batch size

-- Check all fields in construct_faq_pairs that might represent batch size
SELECT 
    'Field Analysis' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'construct_faq_pairs'
  AND table_schema = 'public'
  AND (column_name LIKE '%faq%' OR column_name LIKE '%batch%' OR column_name LIKE '%total%' OR column_name LIKE '%count%')
ORDER BY column_name;

-- Check the actual data to see what these fields contain
SELECT 
    'Data Analysis' as check_type,
    unique_batch_id,
    unique_batch_cluster,
    total_faq_pairs,
    batch_faq_pairs,
    faq_count_in_batch,
    faq_pairs_in_batch,
    organisation,
    created_at
FROM construct_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
ORDER BY created_at DESC
LIMIT 5;

-- Check if there are different values for the same cluster
SELECT 
    'Cluster vs Batch Analysis' as check_type,
    unique_batch_cluster,
    COUNT(*) as batches_in_cluster,
    MIN(total_faq_pairs) as min_total_faq_pairs,
    MAX(total_faq_pairs) as max_total_faq_pairs,
    MIN(batch_faq_pairs) as min_batch_faq_pairs,
    MAX(batch_faq_pairs) as max_batch_faq_pairs,
    MIN(faq_count_in_batch) as min_faq_count_in_batch,
    MAX(faq_count_in_batch) as max_faq_count_in_batch
FROM construct_faq_pairs 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
GROUP BY unique_batch_cluster
ORDER BY unique_batch_cluster; 