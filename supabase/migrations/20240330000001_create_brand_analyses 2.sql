-- Create brand_analyses table
CREATE TABLE IF NOT EXISTS brand_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Analysis metadata
  analysis_status TEXT DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
  url_analyzed TEXT NOT NULL,
  analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Perplexity response data
  perplexity_response JSONB,
  perplexity_status TEXT DEFAULT 'pending' CHECK (perplexity_status IN ('pending', 'success', 'error', 'timeout')),
  perplexity_error_message TEXT,
  perplexity_cost_usd DECIMAL(10,4),
  perplexity_response_time_ms INTEGER,
  
  -- Analysis results (structured data)
  brand_identity JSONB,
  content_summary JSONB,
  technical_insights JSONB,
  customer_insights JSONB,
  competitive_positioning JSONB,
  faq_generation_insights JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_brand_analyses_brand_id ON brand_analyses(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_analyses_auth_user_id ON brand_analyses(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_brand_analyses_status ON brand_analyses(analysis_status);
CREATE INDEX IF NOT EXISTS idx_brand_analyses_date ON brand_analyses(analysis_date);

-- Enable RLS
ALTER TABLE brand_analyses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own brand analyses" ON brand_analyses
  FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert their own brand analyses" ON brand_analyses
  FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own brand analyses" ON brand_analyses
  FOR UPDATE USING (auth.uid() = auth_user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_brand_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_brand_analyses_updated_at
  BEFORE UPDATE ON brand_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_brand_analyses_updated_at(); 