-- Check all existing triggers
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    event_object_table
FROM information_schema.triggers 
ORDER BY trigger_name;

-- Check specifically for invoice-related triggers
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    event_object_table
FROM information_schema.triggers 
WHERE event_object_table = 'invoices'
ORDER BY trigger_name; 