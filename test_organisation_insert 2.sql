-- Test organization insert to isolate the trigger error
-- This will help us identify which trigger function is causing the issue

-- First, let's temporarily disable all triggers to see if the basic insert works
ALTER TABLE client_organisation DISABLE TRIGGER ALL;

-- Test a simple insert without triggers
INSERT INTO client_organisation (
    organisation_name,
    organisation_url,
    linkedin_url,
    auth_user_id,
    industry,
    subcategory,
    headquarters
) VALUES (
    'Test Organisation',
    'https://test.com',
    'https://linkedin.com/company/test',
    '00000000-0000-0000-0000-000000000000', -- dummy UUID
    'Technology',
    'Software',
    'United States'
);

-- Check if the insert worked
SELECT 
    'Test Insert Result' as check_type,
    id,
    organisation_name,
    organisation_url,
    linkedin_url,
    industry,
    subcategory,
    headquarters
FROM client_organisation 
WHERE organisation_name = 'Test Organisation';

-- Clean up the test record
DELETE FROM client_organisation WHERE organisation_name = 'Test Organisation';

-- Now let's re-enable triggers one by one to identify the problematic one
-- Start with just the JSON-LD trigger
ALTER TABLE client_organisation ENABLE TRIGGER set_organisation_jsonld_object;

-- Test insert with just the JSON-LD trigger
INSERT INTO client_organisation (
    organisation_name,
    organisation_url,
    linkedin_url,
    auth_user_id,
    industry,
    subcategory,
    headquarters
) VALUES (
    'Test Organisation 2',
    'https://test2.com',
    'https://linkedin.com/company/test2',
    '00000000-0000-0000-0000-000000000000', -- dummy UUID
    'Technology',
    'Software',
    'United States'
);

-- Check if this insert worked
SELECT 
    'Test Insert with JSON-LD Trigger' as check_type,
    id,
    organisation_name,
    organisation_jsonld_object IS NOT NULL as has_jsonld
FROM client_organisation 
WHERE organisation_name = 'Test Organisation 2';

-- Clean up
DELETE FROM client_organisation WHERE organisation_name = 'Test Organisation 2';

-- Re-enable all triggers
ALTER TABLE client_organisation ENABLE TRIGGER ALL; 