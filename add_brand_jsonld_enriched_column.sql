-- Add brand_jsonld_enriched column to llm_discovery_static table
-- This will store the enriched brand JSON-LD that includes products and other related data

ALTER TABLE llm_discovery_static ADD COLUMN IF NOT EXISTS brand_jsonld_enriched JSONB;

-- Add a comment to document the purpose
COMMENT ON COLUMN llm_discovery_static.brand_jsonld_enriched IS 'Enriched brand JSON-LD that includes products, FAQs, and other related data for complete knowledge graph representation';

-- Verify the column was added
SELECT 
    'Column Added' as status,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'llm_discovery_static' 
AND column_name = 'brand_jsonld_enriched'; 