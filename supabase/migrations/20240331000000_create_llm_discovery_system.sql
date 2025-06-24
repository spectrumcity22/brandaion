-- LLM Discovery System Migration
-- This creates the foundation for LLM-friendly discovery with structured JSON-LD files

-- 1. Create the main LLM discovery files tracking table
CREATE TABLE IF NOT EXISTS llm_discovery_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_path VARCHAR(500) NOT NULL UNIQUE,
    file_type VARCHAR(50) NOT NULL, -- 'platform-index', 'organization-index', 'organization-jsonld', 'brand-index', 'brand-jsonld', 'product-index', 'product-jsonld', 'faq-index', 'faq-jsonld'
    entity_type VARCHAR(50) NOT NULL, -- 'platform', 'organization', 'brand', 'product', 'faq'
    entity_id UUID, -- References the actual entity (org_id, brand_id, etc.)
    entity_slug VARCHAR(255), -- URL-friendly slug
    content_type VARCHAR(50) NOT NULL, -- 'markdown', 'jsonld', 'txt'
    content TEXT, -- The actual file content
    jsonld_data JSONB, -- Structured JSON-LD data
    last_generated TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create organization slugs table for URL-friendly paths
CREATE TABLE IF NOT EXISTS organization_slugs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES client_organisation(id) ON DELETE CASCADE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    organization_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create brand slugs table
CREATE TABLE IF NOT EXISTS brand_slugs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id UUID NOT NULL, -- Will reference brands table
    slug VARCHAR(255) NOT NULL UNIQUE,
    brand_name VARCHAR(255) NOT NULL,
    organization_slug VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create product slugs table
CREATE TABLE IF NOT EXISTS product_slugs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL, -- Will reference products table
    slug VARCHAR(255) NOT NULL UNIQUE,
    product_name VARCHAR(255) NOT NULL,
    brand_slug VARCHAR(255) NOT NULL,
    organization_slug VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Add slug fields to existing tables if they don't exist
DO $$ 
BEGIN
    -- Add slug field to client_organisation if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_organisation' AND column_name = 'slug') THEN
        ALTER TABLE client_organisation ADD COLUMN slug VARCHAR(255);
    END IF;
    
    -- Add slug field to brands if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'slug') THEN
        ALTER TABLE brands ADD COLUMN slug VARCHAR(255);
    END IF;
    
    -- Add slug field to products if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'slug') THEN
        ALTER TABLE products ADD COLUMN slug VARCHAR(255);
    END IF;
END $$;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_llm_discovery_files_path ON llm_discovery_files(file_path);
CREATE INDEX IF NOT EXISTS idx_llm_discovery_files_type ON llm_discovery_files(file_type);
CREATE INDEX IF NOT EXISTS idx_llm_discovery_files_entity ON llm_discovery_files(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_llm_discovery_files_slug ON llm_discovery_files(entity_slug);
CREATE INDEX IF NOT EXISTS idx_organization_slugs_slug ON organization_slugs(slug);
CREATE INDEX IF NOT EXISTS idx_brand_slugs_slug ON brand_slugs(slug);
CREATE INDEX IF NOT EXISTS idx_product_slugs_slug ON product_slugs(slug);

-- 7. Create slug generation function
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(
        regexp_replace(
            regexp_replace(
                regexp_replace(input_text, '[^a-zA-Z0-9\s-]', '', 'g'),
                '\s+', '-', 'g'
            ),
            '-+', '-', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to generate organization slug
CREATE OR REPLACE FUNCTION generate_organization_slug(org_id UUID)
RETURNS TEXT AS $$
DECLARE
    org_name TEXT;
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Get organization name
    SELECT organisation_name INTO org_name 
    FROM client_organisation 
    WHERE id = org_id;
    
    IF org_name IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Generate base slug
    base_slug := generate_slug(org_name);
    final_slug := base_slug;
    
    -- Check for uniqueness and add counter if needed
    WHILE EXISTS (SELECT 1 FROM organization_slugs WHERE slug = final_slug AND organization_id != org_id) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter::TEXT;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to generate brand slug
CREATE OR REPLACE FUNCTION generate_brand_slug(brand_id UUID)
RETURNS TEXT AS $$
DECLARE
    brand_name TEXT;
    org_slug TEXT;
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Get brand name and organization slug
    SELECT b.brand_name, os.slug INTO brand_name, org_slug
    FROM brands b
    JOIN organization_slugs os ON os.organization_id = b.organisation_id
    WHERE b.id = brand_id;
    
    IF brand_name IS NULL OR org_slug IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Generate base slug
    base_slug := generate_slug(brand_name);
    final_slug := base_slug;
    
    -- Check for uniqueness within the organization
    WHILE EXISTS (SELECT 1 FROM brand_slugs WHERE slug = final_slug AND organization_slug = org_slug AND brand_id != brand_id) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter::TEXT;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- 10. Create function to generate product slug
CREATE OR REPLACE FUNCTION generate_product_slug(product_id UUID)
RETURNS TEXT AS $$
DECLARE
    product_name TEXT;
    brand_slug TEXT;
    org_slug TEXT;
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Get product name and brand/organization slugs
    SELECT p.product_name, bs.slug, os.slug INTO product_name, brand_slug, org_slug
    FROM products p
    JOIN brand_slugs bs ON bs.brand_id = p.brand_id
    JOIN brands b ON b.id = p.brand_id
    JOIN organization_slugs os ON os.organization_id = b.organisation_id
    WHERE p.id = product_id;
    
    IF product_name IS NULL OR brand_slug IS NULL OR org_slug IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Generate base slug
    base_slug := generate_slug(product_name);
    final_slug := base_slug;
    
    -- Check for uniqueness within the brand
    WHILE EXISTS (SELECT 1 FROM product_slugs WHERE slug = final_slug AND brand_slug = brand_slug AND product_id != product_id) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter::TEXT;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- 11. Create function to generate platform index
CREATE OR REPLACE FUNCTION generate_platform_index()
RETURNS TEXT AS $$
DECLARE
    index_content TEXT;
    org_record RECORD;
BEGIN
    index_content := '# BrandAION Platform Organizations

This index lists all organizations with LLM-friendly data available on the BrandAION platform.

## Organizations
';
    
    FOR org_record IN 
        SELECT os.slug, co.organisation_name
        FROM organization_slugs os
        JOIN client_organisation co ON co.id = os.organization_id
        WHERE os.is_active = true
        ORDER BY co.organisation_name
    LOOP
        index_content := index_content || '- [' || org_record.organisation_name || '](/data/organizations/' || org_record.slug || '/organization-llms.txt)' || E'\n';
    END LOOP;
    
    index_content := index_content || E'\n## About This Platform

BrandAION provides AI-powered FAQ generation and brand management solutions. Each organization listed above has structured data available including organization details, brands, products, and FAQ collections.

Last updated: ' || to_char(now(), 'YYYY-MM-DD');
    
    RETURN index_content;
END;
$$ LANGUAGE plpgsql;

-- 12. Create function to generate organization JSON-LD
CREATE OR REPLACE FUNCTION generate_organization_jsonld(org_id UUID)
RETURNS JSONB AS $$
DECLARE
    org_record RECORD;
    jsonld_data JSONB;
BEGIN
    SELECT 
        co.id,
        co.organisation_name,
        co.organisation_url,
        co.linkedin_url,
        co.industry,
        co.subcategory,
        co.headquarters,
        os.slug
    INTO org_record
    FROM client_organisation co
    LEFT JOIN organization_slugs os ON os.organization_id = co.id
    WHERE co.id = org_id;
    
    IF org_record.id IS NULL THEN
        RETURN NULL;
    END IF;
    
    jsonld_data := jsonb_build_object(
        '@context', 'https://schema.org',
        '@type', 'Organization',
        '@id', 'https://brandaion.com/data/organizations/' || org_record.slug || '/organization.jsonld',
        'name', org_record.organisation_name,
        'url', COALESCE(org_record.organisation_url, ''),
        'description', 'Organization data from BrandAION platform',
        'industry', COALESCE(org_record.industry, ''),
        'subcategory', COALESCE(org_record.subcategory, ''),
        'headquarters', COALESCE(org_record.headquarters, ''),
        'sameAs', CASE 
            WHEN org_record.linkedin_url IS NOT NULL THEN jsonb_build_array(org_record.linkedin_url)
            ELSE '[]'::jsonb
        END
    );
    
    RETURN jsonld_data;
END;
$$ LANGUAGE plpgsql;

-- 13. Create function to generate organization index
CREATE OR REPLACE FUNCTION generate_organization_index(org_id UUID)
RETURNS TEXT AS $$
DECLARE
    org_record RECORD;
    brand_record RECORD;
    product_record RECORD;
    index_content TEXT;
    org_slug TEXT;
BEGIN
    -- Get organization info
    SELECT co.organisation_name, os.slug INTO org_record
    FROM client_organisation co
    LEFT JOIN organization_slugs os ON os.organization_id = co.id
    WHERE co.id = org_id;
    
    IF org_record.slug IS NULL THEN
        RETURN NULL;
    END IF;
    
    org_slug := org_record.slug;
    
    index_content := '# ' || org_record.organisation_name || ' - LLM Data Index

## Organization Data
- [Organization Details](organization.jsonld) - Core company information, contact details, industry classification

## Brands
- [Brand Overview](brands/brands-llms.txt) - All brands and sub-brands
';
    
    -- Add brands
    FOR brand_record IN 
        SELECT bs.slug, b.brand_name
        FROM brands b
        JOIN brand_slugs bs ON bs.brand_id = b.id
        WHERE b.organisation_id = org_id AND bs.is_active = true
        ORDER BY b.brand_name
    LOOP
        index_content := index_content || '- [' || brand_record.brand_name || '](brands/' || brand_record.slug || '/brand.jsonld) - Brand details and specifications' || E'\n';
    END LOOP;
    
    index_content := index_content || E'\n## Products
- [Product Catalog](brands/*/products/products-llms.txt) - All products across brands

## FAQ Collections
- [All FAQs](faqs/faqs-llms.txt) - Organization-wide FAQ collections
- [Brand FAQs](brands/*/faqs/faqs-llms.txt) - Brand-specific FAQs
- [Product FAQs](brands/*/products/*/faqs/faqs-llms.txt) - Product-specific FAQs

Last updated: ' || to_char(now(), 'YYYY-MM-DD');
    
    RETURN index_content;
END;
$$ LANGUAGE plpgsql;

-- 14. Add RLS policies
ALTER TABLE llm_discovery_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_slugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_slugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_slugs ENABLE ROW LEVEL SECURITY;

-- Public read access for discovery files (these should be publicly accessible)
CREATE POLICY "Public read access for discovery files"
    ON llm_discovery_files
    FOR SELECT
    USING (true);

-- Organization slugs - users can manage their own
CREATE POLICY "Users can manage their organization slugs"
    ON organization_slugs
    FOR ALL
    USING (
        organization_id IN (
            SELECT id FROM client_organisation WHERE auth_user_id = auth.uid()
        )
    );

-- Brand slugs - users can manage their own
CREATE POLICY "Users can manage their brand slugs"
    ON brand_slugs
    FOR ALL
    USING (
        brand_id IN (
            SELECT id FROM brands WHERE auth_user_id = auth.uid()
        )
    );

-- Product slugs - users can manage their own
CREATE POLICY "Users can manage their product slugs"
    ON product_slugs
    FOR ALL
    USING (
        product_id IN (
            SELECT id FROM products WHERE auth_user_id = auth.uid()
        )
    );

-- 15. Create triggers for automatic slug generation
CREATE OR REPLACE FUNCTION trigger_generate_organization_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := generate_organization_slug(NEW.id);
    END IF;
    
    -- Insert or update organization_slugs table
    INSERT INTO organization_slugs (organization_id, slug, organization_name)
    VALUES (NEW.id, NEW.slug, NEW.organisation_name)
    ON CONFLICT (organization_id) 
    DO UPDATE SET 
        slug = EXCLUDED.slug,
        organization_name = EXCLUDED.organisation_name,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_organization_slug_generation
    BEFORE INSERT OR UPDATE ON client_organisation
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_organization_slug();

-- 16. Create updated_at triggers
CREATE OR REPLACE FUNCTION update_llm_discovery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_llm_discovery_files_updated_at
    BEFORE UPDATE ON llm_discovery_files
    FOR EACH ROW
    EXECUTE FUNCTION update_llm_discovery_updated_at();

CREATE TRIGGER update_organization_slugs_updated_at
    BEFORE UPDATE ON organization_slugs
    FOR EACH ROW
    EXECUTE FUNCTION update_llm_discovery_updated_at();

CREATE TRIGGER update_brand_slugs_updated_at
    BEFORE UPDATE ON brand_slugs
    FOR EACH ROW
    EXECUTE FUNCTION update_llm_discovery_updated_at();

CREATE TRIGGER update_product_slugs_updated_at
    BEFORE UPDATE ON product_slugs
    FOR EACH ROW
    EXECUTE FUNCTION update_llm_discovery_updated_at(); 