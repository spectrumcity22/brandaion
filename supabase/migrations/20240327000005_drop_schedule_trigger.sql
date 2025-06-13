-- Drop all schedule-related triggers and functions
DROP TRIGGER IF EXISTS tr_create_schedule_after_invoice ON invoices;
DROP FUNCTION IF EXISTS create_schedule_after_invoice();

DROP TRIGGER IF EXISTS trg_schedule_on_invoice_insert ON invoices;
DROP FUNCTION IF EXISTS trg_generate_schedule(); 