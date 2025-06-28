-- Targeted Subcategory Recommendations for Missing Industries
-- Based on the 6 industries identified as having NO subcategories

-- 1. Professional Services Subcategories
INSERT INTO subcategories (name, industry_id) VALUES
('Management Consulting', 'd6c87b88-6d0b-4568-b126-33384b9f9a69'),
('Legal Services', 'd6c87b88-6d0b-4568-b126-33384b9f9a69'),
('Accounting & Tax Services', 'd6c87b88-6d0b-4568-b126-33384b9f9a69'),
('HR Consulting', 'd6c87b88-6d0b-4568-b126-33384b9f9a69'),
('Financial Advisory', 'd6c87b88-6d0b-4568-b126-33384b9f9a69'),
('IT Consulting', 'd6c87b88-6d0b-4568-b126-33384b9f9a69'),
('Marketing & PR Services', 'd6c87b88-6d0b-4568-b126-33384b9f9a69'),
('Strategy Consulting', 'd6c87b88-6d0b-4568-b126-33384b9f9a69'),
('Operations Consulting', 'd6c87b88-6d0b-4568-b126-33384b9f9a69'),
('Business Process Optimization', 'd6c87b88-6d0b-4568-b126-33384b9f9a69');

-- 2. Public Sector Subcategories
INSERT INTO subcategories (name, industry_id) VALUES
('Government Administration', '3fe03f2c-200a-4ad8-91af-c6c4db09a0cf'),
('Healthcare Services', '3fe03f2c-200a-4ad8-91af-c6c4db09a0cf'),
('Education & Training', '3fe03f2c-200a-4ad8-91af-c6c4db09a0cf'),
('Public Safety & Security', '3fe03f2c-200a-4ad8-91af-c6c4db09a0cf'),
('Transportation & Infrastructure', '3fe03f2c-200a-4ad8-91af-c6c4db09a0cf'),
('Social Services', '3fe03f2c-200a-4ad8-91af-c6c4db09a0cf'),
('Environmental Protection', '3fe03f2c-200a-4ad8-91af-c6c4db09a0cf'),
('Public Utilities', '3fe03f2c-200a-4ad8-91af-c6c4db09a0cf'),
('Regulatory & Compliance', '3fe03f2c-200a-4ad8-91af-c6c4db09a0cf'),
('Public Policy & Research', '3fe03f2c-200a-4ad8-91af-c6c4db09a0cf');

-- 3. Retail & eCommerce Subcategories
INSERT INTO subcategories (name, industry_id) VALUES
('Online Retail', '2036c106-dab2-4a63-8d35-2422ac737379'),
('Brick & Mortar Retail', '2036c106-dab2-4a63-8d35-2422ac737379'),
('Fashion & Apparel', '2036c106-dab2-4a63-8d35-2422ac737379'),
('Electronics Retail', '2036c106-dab2-4a63-8d35-2422ac737379'),
('Grocery & Food Retail', '2036c106-dab2-4a63-8d35-2422ac737379'),
('Home & Garden', '2036c106-dab2-4a63-8d35-2422ac737379'),
('Sports & Outdoor', '2036c106-dab2-4a63-8d35-2422ac737379'),
('Beauty & Personal Care', '2036c106-dab2-4a63-8d35-2422ac737379'),
('Luxury Goods', '2036c106-dab2-4a63-8d35-2422ac737379'),
('Marketplace Platforms', '2036c106-dab2-4a63-8d35-2422ac737379');

-- 4. Technology SaaS Subcategories
INSERT INTO subcategories (name, industry_id) VALUES
('Business Management SaaS', 'b75dfbb7-3ee3-4c60-83cd-f9886809e56b'),
('CRM & Sales Software', 'b75dfbb7-3ee3-4c60-83cd-f9886809e56b'),
('Marketing & Analytics Tools', 'b75dfbb7-3ee3-4c60-83cd-f9886809e56b'),
('HR & Payroll Software', 'b75dfbb7-3ee3-4c60-83cd-f9886809e56b'),
('Project Management Tools', 'b75dfbb7-3ee3-4c60-83cd-f9886809e56b'),
('Communication & Collaboration', 'b75dfbb7-3ee3-4c60-83cd-f9886809e56b'),
('Financial & Accounting Software', 'b75dfbb7-3ee3-4c60-83cd-f9886809e56b'),
('E-commerce & Payment Solutions', 'b75dfbb7-3ee3-4c60-83cd-f9886809e56b'),
('Security & Compliance Tools', 'b75dfbb7-3ee3-4c60-83cd-f9886809e56b'),
('Industry-Specific Solutions', 'b75dfbb7-3ee3-4c60-83cd-f9886809e56b');

-- 5. Travel & Leisure Subcategories
INSERT INTO subcategories (name, industry_id) VALUES
('Accommodation & Hotels', '0cd77da4-1ef9-4d80-bc89-59683c549d8e'),
('Transportation & Airlines', '0cd77da4-1ef9-4d80-bc89-59683c549d8e'),
('Tourism & Travel Services', '0cd77da4-1ef9-4d80-bc89-59683c549d8e'),
('Entertainment & Recreation', '0cd77da4-1ef9-4d80-bc89-59683c549d8e'),
('Restaurants & Food Services', '0cd77da4-1ef9-4d80-bc89-59683c549d8e'),
('Events & Conferences', '0cd77da4-1ef9-4d80-bc89-59683c549d8e'),
('Sports & Fitness', '0cd77da4-1ef9-4d80-bc89-59683c549d8e'),
('Gaming & Casinos', '0cd77da4-1ef9-4d80-bc89-59683c549d8e'),
('Cultural & Arts', '0cd77da4-1ef9-4d80-bc89-59683c549d8e'),
('Adventure & Outdoor Activities', '0cd77da4-1ef9-4d80-bc89-59683c549d8e');

-- 6. Utilities Infrastructure Subcategories
INSERT INTO subcategories (name, industry_id) VALUES
('Electric Power Generation', '86785c6b-97e9-4080-8513-1065ecc723c6'),
('Water & Wastewater Management', '86785c6b-97e9-4080-8513-1065ecc723c6'),
('Natural Gas Distribution', '86785c6b-97e9-4080-8513-1065ecc723c6'),
('Telecommunications Infrastructure', '86785c6b-97e9-4080-8513-1065ecc723c6'),
('Renewable Energy', '86785c6b-97e9-4080-8513-1065ecc723c6'),
('Smart Grid Technology', '86785c6b-97e9-4080-8513-1065ecc723c6'),
('Waste Management & Recycling', '86785c6b-97e9-4080-8513-1065ecc723c6'),
('Transportation Infrastructure', '86785c6b-97e9-4080-8513-1065ecc723c6'),
('Energy Storage Solutions', '86785c6b-97e9-4080-8513-1065ecc723c6'),
('Infrastructure Consulting', '86785c6b-97e9-4080-8513-1065ecc723c6');

-- Verification: Check that all subcategories were added successfully
SELECT 
    'VERIFICATION - SUBCATEGORIES ADDED' as check_type,
    i.name as industry_name,
    COUNT(s.id) as subcategory_count,
    CASE 
        WHEN COUNT(s.id) >= 10 THEN '✅ EXCELLENT COVERAGE'
        WHEN COUNT(s.id) >= 5 THEN '✅ GOOD COVERAGE'
        WHEN COUNT(s.id) >= 2 THEN '⚠️ ADEQUATE COVERAGE'
        ELSE '❌ STILL NEEDS SUBCATEGORIES'
    END as status
FROM industries i
LEFT JOIN subcategories s ON i.id = s.industry_id
WHERE i.name IN ('Professional Services', 'Public Sector', 'Retail & eCommerce', 'Technology SaaS', 'Travel & Leisure', 'Utilities Infrastructure')
GROUP BY i.id, i.name
ORDER BY i.name; 