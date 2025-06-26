-- Check database constraints that might be causing validation errors

-- Check constraints on client_configuration table
SELECT 
    'Client Configuration Constraints' as check_type,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'client_configuration'
  AND tc.table_schema = 'public'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Check constraints on construct_faq_pairs table
SELECT 
    'Construct FAQ Pairs Constraints' as check_type,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'construct_faq_pairs'
  AND tc.table_schema = 'public'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Check for any CHECK constraints that might validate string patterns
SELECT 
    'String Pattern Constraints' as check_type,
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND cc.check_clause LIKE '%pattern%'
  AND tc.table_name IN ('client_configuration', 'construct_faq_pairs', 'client_organisation')
ORDER BY tc.table_name, tc.constraint_name;

-- Check for any triggers that might be causing validation
SELECT 
    'Validation Triggers' as check_type,
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('client_configuration', 'construct_faq_pairs', 'client_organisation')
  AND t.tgname NOT LIKE 'format_ai_request%'
  AND t.tgname NOT LIKE 'tr_generate_questions%'
  AND t.tgname NOT LIKE 'tr_split_questions%'
ORDER BY c.relname, t.tgname;

-- Check the current client_configuration data for any issues
SELECT 
    'Client Configuration Data Check' as check_type,
    id,
    auth_user_id,
    brand_id,
    product_id,
    persona_id,
    market_id,
    audience_id,
    CASE 
        WHEN brand_jsonld_object IS NOT NULL THEN 'Has brand data'
        ELSE 'No brand data'
    END as brand_status,
    CASE 
        WHEN schema_json IS NOT NULL THEN 'Has schema data'
        ELSE 'No schema data'
    END as schema_status,
    CASE 
        WHEN organisation_jsonld_object IS NOT NULL THEN 'Has org data'
        ELSE 'No org data'
    END as org_status
FROM client_configuration 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'; 