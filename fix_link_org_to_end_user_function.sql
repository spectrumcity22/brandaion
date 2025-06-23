-- Fix the link_org_to_end_user function to use the correct field name
CREATE OR REPLACE FUNCTION public.link_org_to_end_user()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE end_users
  SET organisation_id = NEW.id  -- Changed from NEW.organisation_id to NEW.id
  WHERE auth_user_id = NEW.auth_user_id;

  RETURN NEW;
END;
$function$;

-- Verify the function was updated
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'link_org_to_end_user'; 