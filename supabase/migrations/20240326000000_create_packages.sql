-- Create packages table
CREATE TABLE packages (
    tier VARCHAR(255) PRIMARY KEY,
    faq_pairs_pm INTEGER NOT NULL,
    faq_per_batch INTEGER NOT NULL,
    batches_required INTEGER NOT NULL,
    price_per_faq DECIMAL(10,2) NOT NULL,
    package_cost DECIMAL(10,2) NOT NULL,
    cogs_per_faq DECIMAL(10,2) NOT NULL,
    cogs_total DECIMAL(10,2) NOT NULL,
    profit DECIMAL(10,2) NOT NULL,
    profit_margin VARCHAR(10) NOT NULL,
    positioning TEXT NOT NULL,
    sales_message TEXT NOT NULL,
    amount_cents INTEGER NOT NULL
);

-- Insert package data
INSERT INTO packages (
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
) VALUES 
    ('Enterprise', 80, 20, 4, 5.00, 399.00, 1.25, 100.00, 300.00, '75%', 'Provides category dominance, with always-on content and highest coverage.', 'Always-on knowledge ops. Full multi-brand oversight. Immediate impact.', 39900),
    ('Growth', 40, 10, 4, 5.00, 199.00, 1.25, 50.00, 150.00, '75%', 'Designed for brands scaling their AI visibility across key segments.', 'Expand your coverage and deepen your brand footprint across queries.', 19900),
    ('Pro', 60, 15, 4, 5.00, 299.00, 1.25, 75.00, 225.00, '75%', 'Enables broader coverage across use cases, channels, and categories.', 'Strategically dominate your category. With 160+ structured answers.', 29900),
    ('Startup', 20, 5, 4, 5.00, 99.00, 1.25, 25.00, 75.00, '75%', 'Ideal for brands looking to establish foundational visibility in AI channels.', 'Build your AI foundation. Ideal for challenger brands and early-stage players.', 9900); 