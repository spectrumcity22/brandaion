-- Set generation_status to 'pending' for FAQ pairs
UPDATE construct_faq_pairs
SET generation_status = 'pending'
WHERE generation_status IS NULL
   OR generation_status NOT IN ('pending', 'generating_questions', 'completed', 'failed');

-- Add a comment to explain the migration
COMMENT ON TABLE construct_faq_pairs IS 'Updated generation_status to pending for existing records'; 