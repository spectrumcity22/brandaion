-- Check the structure of client_configuration table
SELECT 
    'Table Structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'client_configuration'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check what JSON-LD related columns exist
SELECT 
    'JSON-LD Columns' as check_type,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'client_configuration'
  AND table_schema = 'public'
  AND (column_name LIKE '%jsonld%' OR column_name LIKE '%schema%' OR column_name LIKE '%json%')
ORDER BY column_name;

-- Check sample data from client_configuration
SELECT 
    'Sample Data' as check_type,
    id,
    auth_user_id,
    brand_id,
    product_id,
    persona_id,
    market_id,
    audience_id,
    brand_name,
    product_name,
    persona_name,
    audience_name,
    market_name,
    brand_jsonld_object IS NOT NULL as has_brand_jsonld,
    schema_json IS NOT NULL as has_schema_json,
    persona_jsonld IS NOT NULL as has_persona_jsonld,
    organisation_jsonld_object IS NOT NULL as has_org_jsonld
FROM client_configuration 
WHERE auth_user_id = 'f2de3f3f-94e7-4a8e-85af-77743de0ee2f'
LIMIT 3; 