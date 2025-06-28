-- Add ai_response column to brands table
ALTER TABLE brands ADD COLUMN IF NOT EXISTS ai_response TEXT;

-- Add comment to document the column
COMMENT ON COLUMN brands.ai_response IS 'Stores AI analysis results from Perplexity API'; 