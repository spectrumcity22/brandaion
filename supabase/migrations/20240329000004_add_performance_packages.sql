-- Add new package tiers for monthly FAQ performance testing

-- Insert pack1 (5 questions, 1 LLM)
INSERT INTO public.packages (
    tier,
    faq_pairs_pm,
    faq_per_batch,
    batches_required,
    price_per_faq,
    package_cost,
    cogs_per_faq,
    cogs_total,
    profit,
    profit_margin,
    positioning,
    sales_message,
    amount_cents
) VALUES (
    'pack1',
    5,  -- 5 questions per month
    5,  -- 5 questions per batch
    1,  -- 1 batch required
    2.00,  -- $2 per FAQ
    10.00,  -- $10 total package cost
    0.50,   -- $0.50 COGS per FAQ
    2.50,   -- $2.50 total COGS
    7.50,   -- $7.50 profit
    '75%',  -- 75% profit margin
    'Startup - Basic Performance Monitoring',
    'Monitor 5 key questions with 1 AI provider monthly. Perfect for startups getting started with AI performance tracking.',
    1000    -- $10.00 in cents
);

-- Insert pack2 (10 questions, 2 LLMs)
INSERT INTO public.packages (
    tier,
    faq_pairs_pm,
    faq_per_batch,
    batches_required,
    price_per_faq,
    package_cost,
    cogs_per_faq,
    cogs_total,
    profit,
    profit_margin,
    positioning,
    sales_message,
    amount_cents
) VALUES (
    'pack2',
    10, -- 10 questions per month
    10, -- 10 questions per batch
    1,  -- 1 batch required
    2.00,  -- $2 per FAQ
    20.00,  -- $20 total package cost
    0.50,   -- $0.50 COGS per FAQ
    5.00,   -- $5.00 total COGS
    15.00,  -- $15.00 profit
    '75%',  -- 75% profit margin
    'Growth - Enhanced Performance Monitoring',
    'Monitor 10 questions with 2 AI providers monthly. Ideal for growing businesses wanting comprehensive AI performance insights.',
    2000    -- $20.00 in cents
);

-- Insert pack3 (15 questions, 3 LLMs)
INSERT INTO public.packages (
    tier,
    faq_pairs_pm,
    faq_per_batch,
    batches_required,
    price_per_faq,
    package_cost,
    cogs_per_faq,
    cogs_total,
    profit,
    profit_margin,
    positioning,
    sales_message,
    amount_cents
) VALUES (
    'pack3',
    15, -- 15 questions per month
    15, -- 15 questions per batch
    1,  -- 1 batch required
    2.00,  -- $2 per FAQ
    30.00,  -- $30 total package cost
    0.50,   -- $0.50 COGS per FAQ
    7.50,   -- $7.50 total COGS
    22.50,  -- $22.50 profit
    '75%',  -- 75% profit margin
    'Pro - Advanced Performance Monitoring',
    'Monitor 15 questions with 3 AI providers monthly. Perfect for established businesses requiring detailed AI performance analysis.',
    3000    -- $30.00 in cents
);

-- Insert pack4 (20 questions, 4 LLMs)
INSERT INTO public.packages (
    tier,
    faq_pairs_pm,
    faq_per_batch,
    batches_required,
    price_per_faq,
    package_cost,
    cogs_per_faq,
    cogs_total,
    profit,
    profit_margin,
    positioning,
    sales_message,
    amount_cents
) VALUES (
    'pack4',
    20, -- 20 questions per month
    20, -- 20 questions per batch
    1,  -- 1 batch required
    2.00,  -- $2 per FAQ
    40.00,  -- $40 total package cost
    0.50,   -- $0.50 COGS per FAQ
    10.00,  -- $10.00 total COGS
    30.00,  -- $30.00 profit
    '75%',  -- 75% profit margin
    'Enterprise - Complete Performance Monitoring',
    'Monitor 20 questions with all 4 AI providers monthly. Comprehensive AI performance monitoring for enterprise-level insights.',
    4000    -- $40.00 in cents
);

-- Add comment explaining the new packages
COMMENT ON TABLE public.packages IS 'Updated to include pack1-pack4 for monthly FAQ performance testing system'; 