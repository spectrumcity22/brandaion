-- Find Industries Missing Subcategories
-- This script will show exactly which industries need subcategories

-- 1. Industries with NO subcategories (HIGH PRIORITY)
SELECT 
    '🔴 HIGH PRIORITY - NO SUBCATEGORIES' as priority_level,
    i.id as industry_id,
    i.name as industry_name,
    '0' as subcategory_count
FROM industries i
LEFT JOIN subcategories s ON i.id = s.industry_id
WHERE s.id IS NULL
ORDER BY i.name;

-- 2. Industries with only 1 subcategory (MEDIUM PRIORITY)
SELECT 
    '🟡 MEDIUM PRIORITY - ONLY 1 SUBCATEGORY' as priority_level,
    i.id as industry_id,
    i.name as industry_name,
    s.name as existing_subcategory,
    '1' as subcategory_count
FROM industries i
LEFT JOIN subcategories s ON i.id = s.industry_id
WHERE s.id IS NOT NULL
  AND (SELECT COUNT(*) FROM subcategories s2 WHERE s2.industry_id = i.id) = 1
ORDER BY i.name;

-- 3. All industries with their subcategory counts (COMPLETE OVERVIEW)
SELECT 
    i.id as industry_id,
    i.name as industry_name,
    COUNT(s.id) as subcategory_count,
    CASE 
        WHEN COUNT(s.id) = 0 THEN '🔴 NO SUBCATEGORIES'
        WHEN COUNT(s.id) = 1 THEN '🟡 ONLY 1 SUBCATEGORY'
        WHEN COUNT(s.id) BETWEEN 2 AND 5 THEN '✅ GOOD COVERAGE'
        ELSE '🟢 EXCELLENT COVERAGE'
    END as status
FROM industries i
LEFT JOIN subcategories s ON i.id = s.industry_id
GROUP BY i.id, i.name
ORDER BY subcategory_count ASC, i.name;

-- 4. Quick count by priority level
SELECT 
    'PRIORITY SUMMARY' as summary_type,
    COUNT(CASE WHEN subcategory_count = 0 THEN 1 END) as industries_with_no_subcategories,
    COUNT(CASE WHEN subcategory_count = 1 THEN 1 END) as industries_with_one_subcategory,
    COUNT(CASE WHEN subcategory_count BETWEEN 2 AND 5 THEN 1 END) as industries_with_good_coverage,
    COUNT(CASE WHEN subcategory_count > 5 THEN 1 END) as industries_with_excellent_coverage
FROM (
    SELECT i.id, COUNT(s.id) as subcategory_count
    FROM industries i
    LEFT JOIN subcategories s ON i.id = s.industry_id
    GROUP BY i.id
) subcat_counts; 