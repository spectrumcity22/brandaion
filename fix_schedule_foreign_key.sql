-- Fix the schedule table foreign key constraint
-- The auth_user_id should reference auth.users(id), not end_users(id)

-- First, drop the existing foreign key constraint
ALTER TABLE "public"."schedule" 
DROP CONSTRAINT IF EXISTS "schedule_auth_user_id_fkey";

-- Add the correct foreign key constraint to auth.users
ALTER TABLE "public"."schedule" 
ADD CONSTRAINT "schedule_auth_user_id_fkey" 
FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- Verify the change
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name='schedule' 
    AND kcu.column_name='auth_user_id'; 