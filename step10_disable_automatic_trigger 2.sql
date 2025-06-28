-- Step 10: Disable the automatic trigger that's causing the error
-- This trigger fires every time we insert into schedule table and causes the product_jsonld_object error

DROP TRIGGER IF EXISTS tr_format_ai_request ON schedule; 