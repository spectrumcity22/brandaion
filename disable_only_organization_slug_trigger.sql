-- ONLY disable the organization slug trigger
-- Don't touch anything else

DROP TRIGGER IF EXISTS trigger_organization_slug_generation ON client_organisation;

-- Verify it's disabled
SELECT 
    'Trigger Status' as check_type,
    t.tgname as trigger_name,
    c.relname as table_name,
    CASE WHEN t.tgname = 'trigger_organization_slug_generation' THEN 'Disabled' ELSE 'Still Active' END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'client_organisation' 
AND t.tgname = 'trigger_organization_slug_generation'; 