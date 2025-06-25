-- Check the actual definition of the generate_organisation_jsonld_object function
SELECT 
    'Function Definition' as check_type,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'generate_organisation_jsonld_object';

-- Check the actual definition of the link_org_to_end_user function
SELECT 
    'Function Definition' as check_type,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'link_org_to_end_user';

-- Check the actual definition of the sync_org_jsonld_to_config function
SELECT 
    'Function Definition' as check_type,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'sync_org_jsonld_to_config';

-- Check the actual definition of the trigger_generate_organization_slug function
SELECT 
    'Function Definition' as check_type,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'trigger_generate_organization_slug'; 