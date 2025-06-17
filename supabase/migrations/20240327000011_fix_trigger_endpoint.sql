-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS tr_generate_questions ON public.construct_faq_pairs;
DROP FUNCTION IF EXISTS public.trigger_generate_questions();

-- Create a new function to call the Edge Function
CREATE OR REPLACE FUNCTION public.trigger_generate_questions()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the Edge Function asynchronously
  PERFORM
    net.http_post(
      url := 'https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/open_ai_request_questions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('batchId', NEW.unique_batch_id)
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER tr_generate_questions
  AFTER INSERT ON public.construct_faq_pairs
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_generate_questions(); 