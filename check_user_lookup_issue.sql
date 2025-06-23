-- Check if the user exists in end_users table
SELECT 
    id,
    auth_user_id,
    email,
    first_name,
    last_name,
    org_name,
    created_at
FROM end_users 
WHERE email = 'rickychopra@me.com';

-- Check if the user exists in auth.users table
SELECT 
    id,
    email
FROM auth.users 
WHERE email = 'rickychopra@me.com';

-- Check if there are any invoices for this email
SELECT 
    id,
    user_email,
    auth_user_id,
    amount_cents,
    stripe_payment_id,
    inserted_at
FROM invoices 
WHERE user_email = 'rickychopra@me.com'
ORDER BY inserted_at DESC;

-- Check the webhook log for this specific session
SELECT 
    id,
    payload->>'type' as event_type,
    payload->'data'->'object'->>'id' as session_id,
    payload->'data'->'object'->'customer_details'->>'email' as customer_email,
    processed,
    received_at
FROM stripe_webhook_log 
WHERE payload->'data'->'object'->>'id' = 'cs_test_a1HrUCMEvN2XB4J2B5UMLZrWOspuMVYN2ly55bUVT13gIWXVGSlkeNjRMb';

-- Check if there are any invoices with this stripe_payment_id
SELECT 
    id,
    user_email,
    auth_user_id,
    stripe_payment_id,
    inserted_at
FROM invoices 
WHERE stripe_payment_id = 'cs_test_a1HrUCMEvN2XB4J2B5UMLZrWOspuMVYN2ly55bUVT13gIWXVGSlkeNjRMb';

-- Check the set_invoice_auth_user function to see if it's working correctly
-- This will show us if the trigger is failing to set auth_user_id
SELECT 
    i.id,
    i.user_email,
    i.auth_user_id,
    eu.id as end_user_id,
    eu.auth_user_id as end_user_auth_id,
    CASE 
        WHEN i.auth_user_id IS NULL THEN '❌ Missing auth_user_id'
        WHEN eu.id IS NULL THEN '❌ User not found in end_users'
        WHEN i.auth_user_id = eu.auth_user_id THEN '✅ Match found'
        ELSE '❌ Mismatch'
    END as status
FROM invoices i
LEFT JOIN end_users eu ON i.user_email = eu.email
WHERE i.user_email = 'rickychopra@me.com'
ORDER BY i.inserted_at DESC; 