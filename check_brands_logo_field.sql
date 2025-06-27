-- Check brands table structure to see if logo_url field exists
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'brands' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if any brands have logo_url populated
SELECT 
    id,
    brand_name,
    logo_url,
    CASE 
        WHEN logo_url IS NOT NULL AND logo_url != '' THEN 'Has Logo'
        ELSE 'No Logo'
    END as logo_status
FROM brands 
ORDER BY created_at DESC;

-- Count brands with and without logos
SELECT 
    COUNT(*) as total_brands,
    COUNT(CASE WHEN logo_url IS NOT NULL AND logo_url != '' THEN 1 END) as brands_with_logos,
    COUNT(CASE WHEN logo_url IS NULL OR logo_url = '' THEN 1 END) as brands_without_logos
FROM brands;

-- Check the most recent brands with their logo status
SELECT 
    brand_name,
    organisation_name,
    logo_url,
    created_at,
    CASE 
        WHEN logo_url IS NOT NULL AND logo_url != '' THEN '✅ Has Logo'
        ELSE '❌ No Logo'
    END as logo_status
FROM brands 
ORDER BY created_at DESC 
LIMIT 10; 