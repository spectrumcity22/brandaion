-- Add policy to allow service role to insert (bypasses auth.uid() check)
CREATE POLICY "Service role can insert performance logs" ON faq_performance_logs
FOR INSERT TO service_role
WITH CHECK (true);

-- Add policy to allow service role to select (for automated testing)
CREATE POLICY "Service role can select performance logs" ON faq_performance_logs
FOR SELECT TO service_role
USING (true);

-- Verify the new policies were created
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