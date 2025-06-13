-- Create schedules table
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL,
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    batch_1_date TIMESTAMP WITH TIME ZONE NOT NULL,
    batch_2_date TIMESTAMP WITH TIME ZONE NOT NULL,
    batch_3_date TIMESTAMP WITH TIME ZONE NOT NULL,
    batch_4_date TIMESTAMP WITH TIME ZONE NOT NULL,
    faq_pairs_pm INTEGER NOT NULL,
    faq_per_batch INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    inserted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
); 