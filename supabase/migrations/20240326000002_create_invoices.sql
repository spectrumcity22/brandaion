-- Create invoices table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email VARCHAR(255) NOT NULL,
    auth_user_id UUID NOT NULL,
    amount_cents INTEGER NOT NULL,
    stripe_payment_id VARCHAR(255) NOT NULL,
    stripe_subscription_id VARCHAR(255),
    billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL,
    package_tier VARCHAR(255) NOT NULL REFERENCES packages(tier),
    faq_pairs_pm INTEGER NOT NULL,
    faq_per_batch INTEGER NOT NULL,
    inserted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_to_schedule BOOLEAN NOT NULL DEFAULT false
); 