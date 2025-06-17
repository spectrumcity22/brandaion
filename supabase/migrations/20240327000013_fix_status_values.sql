-- Update any records with invalid status values to 'pending'
UPDATE public.construct_faq_pairs
SET generation_status = 'pending'
WHERE generation_status NOT IN ('pending', 'generating_questions', 'generating_answers', 'completed', 'failed');

-- Add a comment to explain the migration
COMMENT ON TABLE public.construct_faq_pairs IS 'Updated generation_status to valid values for all records'; 