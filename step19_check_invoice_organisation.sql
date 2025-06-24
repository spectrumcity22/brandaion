-- Step 19: Check the invoice records to see what organisation data is missing
SELECT 
    id,
    auth_user_id,
    user_email,
    organisation,
    billing_period_start,
    billing_period_end,
    faq_pairs_pm,
    sent_to_schedule,
    inserted_at
FROM invoices 
WHERE id IN ('cs_test_a1KljtCoRISSmeC55wP2p3a5tHIu0VAI2YKZXkwbhcpw1s0REoOYr0Rct1', 'in_1RdE7ERvWgSPtSJgCGGpUTCq')
ORDER BY inserted_at DESC; 