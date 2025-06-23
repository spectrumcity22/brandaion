-- Check triggers on client_organisation table
SELECT 
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    t.tgenabled as enabled,
    t.tgtype,
    CASE 
        WHEN t.tgtype & 66 = 2 THEN 'BEFORE'
        WHEN t.tgtype & 66 = 64 THEN 'AFTER'
        WHEN t.tgtype & 66 = 0 THEN 'INSTEAD OF'
        ELSE 'UNKNOWN'
    END as timing,
    CASE 
        WHEN t.tgtype & 28 = 4 THEN 'INSERT'
        WHEN t.tgtype & 28 = 8 THEN 'DELETE'
        WHEN t.tgtype & 28 = 16 THEN 'UPDATE'
        WHEN t.tgtype & 28 = 12 THEN 'INSERT OR DELETE'
        WHEN t.tgtype & 28 = 20 THEN 'INSERT OR UPDATE'
        WHEN t.tgtype & 28 = 24 THEN 'DELETE OR UPDATE'
        WHEN t.tgtype & 28 = 28 THEN 'INSERT OR DELETE OR UPDATE'
        ELSE 'UNKNOWN'
    END as event
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'client_organisation'
ORDER BY t.tgname;

-- Check the function definitions for these triggers
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname IN (
    'generate_organisation_jsonld_object',
    'link_org_to_end_user', 
    'sync_org_jsonld_to_config'
)
ORDER BY p.proname;

-- Check if these functions exist
SELECT 
    p.proname as function_name,
    CASE WHEN p.proname IS NOT NULL THEN '✅ Exists' ELSE '❌ Missing' END as status
FROM (
    SELECT 'generate_organisation_jsonld_object' as proname
    UNION ALL SELECT 'link_org_to_end_user'
    UNION ALL SELECT 'sync_org_jsonld_to_config'
) expected
LEFT JOIN pg_proc p ON p.proname = expected.proname
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid AND n.nspname = 'public'
ORDER BY expected.proname; 