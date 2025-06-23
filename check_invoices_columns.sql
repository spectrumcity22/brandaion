-- Check what columns actually exist in invoices table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoices' 
ORDER BY ordinal_position; 