INSERT INTO stripe_webhook_log (
  id,
  payload,
  processed
) VALUES (
  'test_webhook_001',
  '{
    "id": "evt_test_001",
    "type": "invoice.paid",
    "data": {
      "object": {
        "id": "in_test_001",
        "customer": "cus_test_001",
        "customer_email": "rickychopra@me.com",
        "amount_paid": 9900,
        "currency": "gbp",
        "status": "paid",
        "lines": {
          "data": [{
            "description": "Startup Package",
            "amount": 9900,
            "metadata": {
              "faq_pairs_pm": "20",
              "faq_per_batch": "5"
            }
          }]
        },
        "created": 1716950648
      }
    }
  }',
  false
); 