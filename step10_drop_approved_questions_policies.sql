-- Step 10: Drop RLS policies on approved_questions table

-- Drop the policies that are preventing the table from being dropped
DROP POLICY IF EXISTS "Service role can update all approved questions" ON public.approved_questions;
DROP POLICY IF EXISTS "Users can insert approved questions for their organization" ON public.approved_questions;
DROP POLICY IF EXISTS "Users can view approved questions for their organization" ON public.approved_questions; 