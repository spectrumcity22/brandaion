-- Check audiences table for problematic entries
SELECT id, target_audience FROM audiences ORDER BY id;

-- Look for any entries that might be "harmonised Yaml audience" or similar
SELECT id, target_audience FROM audiences 
WHERE target_audience ILIKE '%harmonised%' 
   OR target_audience ILIKE '%yaml%' 
   OR target_audience ILIKE '%yaml%'
ORDER BY id;
