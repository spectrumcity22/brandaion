-- LLM Discovery Tables Migration
-- Creates the foundation tables for LLM-friendly discovery system

-- 1. Create static objects table (one row per client)
CREATE TABLE IF NOT EXISTS llm_discovery_static (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id),
    client_organisation_id UUID NOT NULL REFERENCES client_organisation(id),
    organization_jsonld JSONB,
    brand_jsonld JSONB,
    product_jsonld JSONB,
    last_generated TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(auth_user_id)
);

-- 2. Create weekly FAQ objects table
CREATE TABLE IF NOT EXISTS llm_discovery_faq_objects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    batch_faq_pairs_id UUID NOT NULL REFERENCES batch_faq_pairs(id),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id),
    client_organisation_id UUID NOT NULL REFERENCES client_organisation(id),
    brand_id UUID REFERENCES brands(id),
    product_id UUID REFERENCES products(id),
    week_start_date DATE NOT NULL,
    faq_json_object JSONB,
    organization_jsonld JSONB,
    brand_jsonld JSONB,
    product_jsonld JSONB,
    last_generated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_llm_discovery_static_auth_user_id ON llm_discovery_static(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_llm_discovery_static_org_id ON llm_discovery_static(client_organisation_id);
CREATE INDEX IF NOT EXISTS idx_llm_discovery_static_active ON llm_discovery_static(is_active);

CREATE INDEX IF NOT EXISTS idx_llm_discovery_faq_auth_user_id ON llm_discovery_faq_objects(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_llm_discovery_faq_org_id ON llm_discovery_faq_objects(client_organisation_id);
CREATE INDEX IF NOT EXISTS idx_llm_discovery_faq_brand_id ON llm_discovery_faq_objects(brand_id);
CREATE INDEX IF NOT EXISTS idx_llm_discovery_faq_product_id ON llm_discovery_faq_objects(product_id);
CREATE INDEX IF NOT EXISTS idx_llm_discovery_faq_week_start ON llm_discovery_faq_objects(week_start_date);
CREATE INDEX IF NOT EXISTS idx_llm_discovery_faq_batch_id ON llm_discovery_faq_objects(batch_faq_pairs_id);

-- 4. Add RLS policies
ALTER TABLE llm_discovery_static ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_discovery_faq_objects ENABLE ROW LEVEL SECURITY;

-- Static objects - users can manage their own
CREATE POLICY "Users can manage their own static discovery objects"
    ON llm_discovery_static
    FOR ALL
    USING (auth_user_id = auth.uid());

-- FAQ objects - users can manage their own
CREATE POLICY "Users can manage their own FAQ discovery objects"
    ON llm_discovery_faq_objects
    FOR ALL
    USING (auth_user_id = auth.uid());

-- 5. Create updated_at triggers
CREATE OR REPLACE FUNCTION update_llm_discovery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_llm_discovery_static_updated_at
    BEFORE UPDATE ON llm_discovery_static
    FOR EACH ROW
    EXECUTE FUNCTION update_llm_discovery_updated_at();

CREATE TRIGGER update_llm_discovery_faq_objects_updated_at
    BEFORE UPDATE ON llm_discovery_faq_objects
    FOR EACH ROW
    EXECUTE FUNCTION update_llm_discovery_updated_at(); 