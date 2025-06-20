-- Step 11: Check for more dependencies on approved_questions

-- Check for sequences used by approved_questions
SELECT 
    sequence_name,
    data_type,
    start_value,
    increment
FROM information_schema.sequences 
WHERE sequence_name LIKE '%approved_questions%';

-- Check for indexes on approved_questions
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'approved_questions';

-- Check for any remaining constraints
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.approved_questions'::regclass; 