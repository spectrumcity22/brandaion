-- Check what data exists in faq_performance_logs
SELECT 
    id,
    auth_user_id,
    question_id,
    test_schedule,
    test_month,
    tested_llms,
    openai_status,
    gemini_status,
    perplexity_status,
    claude_status,
    created_at,
    to_char(created_at, 'YYYY-MM') as created_month
FROM faq_performance_logs 
ORDER BY created_at DESC 
LIMIT 10;

-- Check for records with test_schedule = 'monthly'
SELECT 
    COUNT(*) as total_monthly_records,
    COUNT(CASE WHEN test_schedule = 'monthly' THEN 1 END) as monthly_schedule_records,
    COUNT(CASE WHEN test_schedule = 'manual' THEN 1 END) as manual_schedule_records
FROM faq_performance_logs;

-- Check current month records specifically
SELECT 
    COUNT(*) as current_month_records,
    MIN(created_at) as earliest_record,
    MAX(created_at) as latest_record
FROM faq_performance_logs 
WHERE to_char(created_at, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM'); 