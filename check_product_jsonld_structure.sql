-- Check what's in the product_jsonld field to see if it contains the correct product name
SELECT 
  'Product JSON-LD Structure Check' as check_type,
  id,
  auth_user_id,
  client_organisation_id,
  CASE 
    WHEN product_jsonld IS NULL THEN 'NULL'
    WHEN jsonb_typeof(product_jsonld) = 'object' THEN 'JSON Object'
    ELSE jsonb_typeof(product_jsonld)::text
  END as product_jsonld_type,
  CASE 
    WHEN product_jsonld IS NULL THEN 'NULL'
    WHEN jsonb_typeof(product_jsonld) = 'object' THEN 
      CASE 
        WHEN product_jsonld ? 'name' THEN product_jsonld->>'name'
        WHEN product_jsonld ? 'title' THEN product_jsonld->>'title'
        WHEN product_jsonld ? '@graph' THEN 'Has @graph array'
        ELSE 'Object without name/title'
      END
    ELSE 'Not an object'
  END as product_name_from_jsonld,
  CASE 
    WHEN product_jsonld IS NULL THEN 'NULL'
    WHEN jsonb_typeof(product_jsonld) = 'object' THEN 
      jsonb_pretty(product_jsonld)
    ELSE product_jsonld::text
  END as product_jsonld_content
FROM llm_discovery_static 
WHERE product_jsonld IS NOT NULL
ORDER BY last_generated DESC
LIMIT 5; 