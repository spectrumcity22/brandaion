-- Analyze Industries and Subcategories
-- This script will identify industries without subcategories and provide recommendations

-- 1. Get all industries and their subcategory counts
SELECT 
    i.id,
    i.name as industry_name,
    COUNT(s.id) as subcategory_count,
    CASE 
        WHEN COUNT(s.id) = 0 THEN '❌ NO SUBCATEGORIES'
        WHEN COUNT(s.id) = 1 THEN '⚠️ ONLY 1 SUBCATEGORY'
        WHEN COUNT(s.id) BETWEEN 2 AND 5 THEN '✅ GOOD COVERAGE'
        ELSE '🟢 EXCELLENT COVERAGE'
    END as status
FROM industries i
LEFT JOIN subcategories s ON i.id = s.industry_id
GROUP BY i.id, i.name
ORDER BY subcategory_count ASC, i.name;

-- 2. List industries with NO subcategories (priority 1)
SELECT 
    'INDUSTRIES WITH NO SUBCATEGORIES' as analysis_type,
    i.name as industry_name,
    i.id as industry_id
FROM industries i
LEFT JOIN subcategories s ON i.id = s.industry_id
WHERE s.id IS NULL
ORDER BY i.name;

-- 3. List industries with only 1 subcategory (priority 2)
SELECT 
    'INDUSTRIES WITH ONLY 1 SUBCATEGORY' as analysis_type,
    i.name as industry_name,
    i.id as industry_id,
    s.name as existing_subcategory
FROM industries i
LEFT JOIN subcategories s ON i.id = s.industry_id
WHERE s.id IS NOT NULL
  AND (SELECT COUNT(*) FROM subcategories s2 WHERE s2.industry_id = i.id) = 1
ORDER BY i.name;

-- 4. Show current subcategories for reference
SELECT 
    'CURRENT SUBCATEGORIES' as analysis_type,
    i.name as industry_name,
    s.name as subcategory_name,
    s.id as subcategory_id
FROM industries i
JOIN subcategories s ON i.id = s.industry_id
ORDER BY i.name, s.name;

-- 5. Count total industries and subcategories (FIXED)
SELECT 
    'SUMMARY STATISTICS' as analysis_type,
    COUNT(DISTINCT i.id) as total_industries,
    COUNT(s.id) as total_subcategories,
    COUNT(DISTINCT i.id) - COUNT(DISTINCT s.industry_id) as industries_without_subcategories,
    ROUND(
        CASE 
            WHEN COUNT(DISTINCT s.industry_id) > 0 
            THEN COUNT(s.id)::numeric / COUNT(DISTINCT s.industry_id)
            ELSE 0 
        END, 2
    ) as avg_subcategories_per_industry
FROM industries i
LEFT JOIN subcategories s ON i.id = s.industry_id; 