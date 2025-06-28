-- Fix "harmonised Yaml audience" issue
-- First, let's see what's in the audiences table
SELECT id, target_audience FROM audiences ORDER BY id;

-- Look for the problematic entry
SELECT id, target_audience FROM audiences 
WHERE target_audience ILIKE '%harmonised%' 
   OR target_audience ILIKE '%yaml%' 
   OR target_audience ILIKE '%yaml%'
ORDER BY id;

-- If we find "harmonised Yaml audience", we should either:
-- 1. Delete it if it's not a real audience
-- 2. Update it to a proper audience name
-- 3. Mark it as inactive

-- Option 1: Delete the problematic entry (uncomment if needed)
-- DELETE FROM audiences WHERE target_audience ILIKE '%harmonised%' OR target_audience ILIKE '%yaml%';

-- Option 2: Update to a proper audience name (uncomment and modify if needed)
-- UPDATE audiences 
-- SET target_audience = 'General Consumers' 
-- WHERE target_audience ILIKE '%harmonised%' OR target_audience ILIKE '%yaml%';

-- Option 3: Add an 'active' column and mark as inactive (if column doesn't exist)
-- ALTER TABLE audiences ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
-- UPDATE audiences 
-- SET active = false 
-- WHERE target_audience ILIKE '%harmonised%' OR target_audience ILIKE '%yaml%';

-- Then update the client configuration form to only show active audiences
-- SELECT id, target_audience FROM audiences WHERE active = true ORDER BY id; 