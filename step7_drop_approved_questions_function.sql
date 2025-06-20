-- Step 7: Drop the function linked to approved_questions

-- Drop the function that's trying to insert into review_questions (which was originally for approved_questions)
DROP FUNCTION IF EXISTS public.split_questions_into_review();

-- Drop the trigger that calls this function
DROP TRIGGER IF EXISTS tr_split_questions_on_generation ON public.construct_faq_pairs; 