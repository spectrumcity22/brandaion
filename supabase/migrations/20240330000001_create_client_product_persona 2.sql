-- Create client_product_persona table
CREATE TABLE IF NOT EXISTS client_product_persona (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id),
    organisation_name VARCHAR(255),
    persona_name VARCHAR(255) NOT NULL,
    core_brand_value VARCHAR(255),
    brand_tone_of_voice TEXT,
    brand_archetype VARCHAR(255),
    customer_emotions VARCHAR(255),
    communication_style TEXT,
    brand_voice_humor TEXT,
    language_complexity TEXT,
    emotional_expressiveness TEXT,
    words_to_avoid TEXT,
    customer_address_style TEXT,
    brand_communication_purpose TEXT,
    brand_tagline VARCHAR(255),
    brand_visual_metaphor VARCHAR(255),
    language_region_preference VARCHAR(255),
    competitor_voice_contrast VARCHAR(255),
    copywriter_type VARCHAR(255),
    content_dos_and_donts TEXT,
    persona_jsonld JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE client_product_persona ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own personas"
    ON client_product_persona
    FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert their own personas"
    ON client_product_persona
    FOR INSERT
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own personas"
    ON client_product_persona
    FOR UPDATE
    USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can delete their own personas"
    ON client_product_persona
    FOR DELETE
    USING (auth.uid() = auth_user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_client_product_persona_auth_user_id ON client_product_persona(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_client_product_persona_persona_name ON client_product_persona(persona_name);

-- Create updated_at trigger
CREATE TRIGGER update_client_product_persona_updated_at
    BEFORE UPDATE ON client_product_persona
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Remove product relationship from client_product_persona table
-- Since personas are no longer related to products

-- Drop the foreign key constraint
ALTER TABLE client_product_persona 
DROP CONSTRAINT IF EXISTS client_product_persona_product_id_fkey;

-- Make product_id nullable and remove NOT NULL constraint
ALTER TABLE client_product_persona 
ALTER COLUMN product_id DROP NOT NULL;

-- Add comment to document the change
COMMENT ON TABLE client_product_persona IS 'Updated to remove product relationship - personas are now independent'; 