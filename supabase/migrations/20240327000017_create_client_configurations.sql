-- Create client_configurations table
CREATE TABLE IF NOT EXISTS client_configurations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id),
    brand_id UUID NOT NULL REFERENCES brands(id),
    product_id UUID NOT NULL REFERENCES products(id),
    persona_id UUID NOT NULL REFERENCES client_product_persona(id),
    market_id UUID NOT NULL REFERENCES markets(id),
    audience_id UUID NOT NULL REFERENCES audiences(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(auth_user_id)
);

-- Add RLS policies
ALTER TABLE client_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own configurations"
    ON client_configurations
    FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert their own configurations"
    ON client_configurations
    FOR INSERT
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own configurations"
    ON client_configurations
    FOR UPDATE
    USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_client_configurations_updated_at
    BEFORE UPDATE ON client_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 