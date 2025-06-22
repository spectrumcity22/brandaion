-- Enable RLS on faq_performance_logs if not already enabled
ALTER TABLE faq_performance_logs ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies that might be blocking service role
DROP POLICY IF EXISTS "Allow service role insert" ON faq_performance_logs;
DROP POLICY IF EXISTS "Allow service role select" ON faq_performance_logs;

-- Create policy to allow service role to insert
CREATE POLICY "Allow service role insert" ON faq_performance_logs
FOR INSERT TO service_role
WITH CHECK (true);

-- Create policy to allow service role to select
CREATE POLICY "Allow service role select" ON faq_performance_logs
FOR SELECT TO service_role
USING (true);

-- Create policy to allow authenticated users to select their own data
CREATE POLICY "Allow users to select own data" ON faq_performance_logs
FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());

-- Create policy to allow authenticated users to insert their own data
CREATE POLICY "Allow users to insert own data" ON faq_performance_logs
FOR INSERT TO authenticated
WITH CHECK (auth_user_id = auth.uid());

-- Verify policies were created
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'faq_performance_logs'
ORDER BY policyname; 