-- Step 12: Drop approved_questions table with CASCADE

-- This will drop the table and all its dependencies (constraints, indexes, etc.)
DROP TABLE IF EXISTS public.approved_questions CASCADE; 