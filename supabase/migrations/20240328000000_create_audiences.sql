-- Create audiences table
CREATE TABLE IF NOT EXISTS audiences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    target_audience TEXT NOT NULL,
    json_audience JSONB NOT NULL,
    detailed_audience UUID REFERENCES storage.objects(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audiences_target_audience ON audiences(target_audience);
CREATE INDEX IF NOT EXISTS idx_audiences_json_audience ON audiences USING GIN (json_audience);

-- Add RLS (Row Level Security) policies
ALTER TABLE audiences ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to view all audiences
CREATE POLICY "Allow authenticated users to view audiences"
    ON audiences FOR SELECT
    TO authenticated
    USING (true);

-- Create policy to allow authenticated users to insert audiences
CREATE POLICY "Allow authenticated users to insert audiences"
    ON audiences FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Create policy to allow authenticated users to update their own audiences
CREATE POLICY "Allow authenticated users to update audiences"
    ON audiences FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create policy to allow authenticated users to delete their own audiences
CREATE POLICY "Allow authenticated users to delete audiences"
    ON audiences FOR DELETE
    TO authenticated
    USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_audiences_updated_at
    BEFORE UPDATE ON audiences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 