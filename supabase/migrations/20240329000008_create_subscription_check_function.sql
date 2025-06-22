-- Create function to check user subscription status

CREATE OR REPLACE FUNCTION check_user_subscription_status(user_id UUID)
RETURNS TABLE(
    subscription_status TEXT,
    can_continue_testing BOOLEAN,
    package_tier TEXT,
    next_test_date DATE,
    has_active_subscription BOOLEAN
) AS $$
DECLARE
    user_email TEXT;
    latest_invoice RECORD;
    schedule_record RECORD;
    subscription_status_val TEXT := 'inactive';
    can_continue_testing_val BOOLEAN := false;
    package_tier_val TEXT := null;
    next_test_date_val DATE := null;
    has_active_subscription_val BOOLEAN := false;
BEGIN
    -- Get user's email
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = user_id;
    
    IF user_email IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Get latest paid invoice
    SELECT * INTO latest_invoice
    FROM invoices
    WHERE user_email = user_email
      AND status = 'paid'
    ORDER BY paid_at DESC
    LIMIT 1;
    
    -- Check if user has active subscription
    IF latest_invoice IS NOT NULL THEN
        has_active_subscription_val := true;
        
        -- Check if subscription is still active (within billing period)
        IF latest_invoice.billing_period_end > CURRENT_DATE THEN
            subscription_status_val := 'active';
            can_continue_testing_val := true;
            package_tier_val := latest_invoice.package_tier;
        ELSE
            subscription_status_val := 'expired';
            can_continue_testing_val := false;
        END IF;
    END IF;
    
    -- Get user's monthly schedule
    SELECT * INTO schedule_record
    FROM user_monthly_schedule
    WHERE user_id = user_id;
    
    -- Set next test date
    IF schedule_record IS NOT NULL THEN
        next_test_date_val := schedule_record.next_test_date;
        
        -- Update schedule with current subscription status
        UPDATE user_monthly_schedule
        SET 
            subscription_status = subscription_status_val,
            package_tier = COALESCE(package_tier_val, schedule_record.package_tier),
            updated_at = NOW()
        WHERE user_id = user_id;
    ELSIF has_active_subscription_val THEN
        -- Create new schedule if user has subscription but no schedule
        INSERT INTO user_monthly_schedule (
            user_id,
            package_tier,
            subscription_status,
            first_schedule_date,
            next_test_date
        ) VALUES (
            user_id,
            package_tier_val,
            subscription_status_val,
            CURRENT_DATE,
            CURRENT_DATE
        );
        
        next_test_date_val := CURRENT_DATE;
    END IF;
    
    RETURN QUERY
    SELECT 
        subscription_status_val,
        can_continue_testing_val,
        package_tier_val,
        next_test_date_val,
        has_active_subscription_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION check_user_subscription_status(UUID) IS 'Checks user subscription status by querying invoices table and updates monthly schedule accordingly'; 