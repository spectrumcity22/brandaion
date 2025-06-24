-- Step 13: Disable the automatic trigger that's causing the error
-- The merge_schedule_and_configuration edge function already handles this manually

DROP TRIGGER IF EXISTS tr_format_ai_request ON schedule; 