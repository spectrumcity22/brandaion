-- Drop the trigger and function for automatic question generation
DROP TRIGGER IF EXISTS tr_generate_questions ON public.construct_faq_pairs;
DROP FUNCTION IF EXISTS public.trigger_generate_questions();

-- Add a comment to explain the migration
COMMENT ON TABLE public.construct_faq_pairs IS 'Removed automatic triggers for question generation to enable manual control'; 