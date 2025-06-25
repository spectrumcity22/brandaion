-- Check for triggers on llm_discovery_static
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'llm_discovery_static';

-- Check for functions using llm_discovery_static
SELECT 
    routine_name, 
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_definition ILIKE '%llm_discovery_static%'
AND routine_schema = 'public';

-- Check for functions using organisation_jsonld_object
SELECT 
    routine_name, 
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_definition ILIKE '%organisation_jsonld_object%'
AND routine_schema = 'public';

-- Check for functions using organisation_jsonld_enriched
SELECT 
    routine_name, 
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_definition ILIKE '%organisation_jsonld_enriched%'
AND routine_schema = 'public';

-- Check current structure of llm_discovery_static
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'llm_discovery_static'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check for any RLS policies on llm_discovery_static
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'llm_discovery_static'; 