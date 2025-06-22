-- Fix the database function to handle correct data types
DROP FUNCTION IF EXISTS check_user_subscription_status(TEXT);

CREATE OR REPLACE FUNCTION check_user_subscription_status(user_email TEXT)
RETURNS TABLE(
  has_active_subscription BOOLEAN,
  subscription_status TEXT,
  package_tier TEXT,
  billing_period_end TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN i.billing_period_end > CURRENT_TIMESTAMP THEN TRUE 
      ELSE FALSE 
    END as has_active_subscription,
    CASE 
      WHEN i.billing_period_end > CURRENT_TIMESTAMP THEN 'active'
      WHEN i.billing_period_end <= CURRENT_TIMESTAMP THEN 'expired'
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