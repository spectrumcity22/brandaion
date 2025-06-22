-- Create the database function for checking subscription status
-- This function can be called from within the database (triggers, other functions, etc.)

CREATE OR REPLACE FUNCTION check_user_subscription_status(user_email TEXT)
RETURNS TABLE(
  has_active_subscription BOOLEAN,
  subscription_status TEXT,
  package_tier TEXT,
  billing_period_end DATE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN i.billing_period_end > CURRENT_DATE THEN TRUE 
      ELSE FALSE 
    END as has_active_subscription,
    CASE 
      WHEN i.billing_period_end > CURRENT_DATE THEN 'active'
      WHEN i.billing_period_end <= CURRENT_DATE THEN 'expired'
      ELSE 'inactive'
    END as subscription_status,
    i.package_tier,
    i.billing_period_end
  FROM invoices i
  WHERE i.user_email = check_user_subscription_status.user_email
    AND i.status = 'paid'
  ORDER BY i.paid_at DESC
  LIMIT 1;
  
  -- If no rows found, return default values
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'inactive', NULL, NULL;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_user_subscription_status(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_subscription_status(TEXT) TO service_role; 