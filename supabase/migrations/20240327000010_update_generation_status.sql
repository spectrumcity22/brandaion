-- Update the allowed values for generation_status
ALTER TABLE public.construct_faq_pairs
DROP CONSTRAINT IF EXISTS construct_faq_pairs_generation_status_check;

ALTER TABLE public.construct_faq_pairs
ADD CONSTRAINT construct_faq_pairs_generation_status_check 
CHECK (generation_status IN ('pending', 'generating_questions', 'generating_answers', 'completed', 'failed'));

-- Update any existing records that might have the old status
UPDATE public.construct_faq_pairs
SET generation_status = 'pending'
WHERE generation_status = 'questions_generated'; 