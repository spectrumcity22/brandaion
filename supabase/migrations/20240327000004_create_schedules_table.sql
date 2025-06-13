-- Create schedules table
CREATE TABLE IF NOT EXISTS schedules (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id uuid NOT NULL,
    invoice_id text NOT NULL REFERENCES invoices(id),
    batch_1_date timestamp with time zone,
    batch_2_date timestamp with time zone,
    batch_3_date timestamp with time zone,
    batch_4_date timestamp with time zone,
    faq_pairs_pm integer,
    faq_per_batch integer,
    status text DEFAULT 'active',
    billing_period_start timestamp with time zone,
    billing_period_end timestamp with time zone,
    inserted_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
); 