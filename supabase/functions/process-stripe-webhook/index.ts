import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

console.log('Initializing with URL:', supabaseUrl); // Debug log

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

interface WebhookLog {
  id: string;
  payload: {
    id: string;
    type: string;
    data: {
      object: {
        id: string;
        customer: string;
        customer_email: string;
        amount_paid: number;
        currency: string;
        status: string;
        subscription: string;
        period_start: number;
        period_end: number;
        lines: {
          data: Array<{
            description: string;
            amount: number;
            metadata?: {
              faq_pairs_pm?: string;
              faq_per_batch?: string;
            };
          }>;
        };
        created: number;
      };
    };
  };
  processed: boolean;
}

serve(async (req) => {
  try {
    console.log('Function started'); // Debug log
    
    // 1. Fetch unprocessed webhook logs
    const { data: logs, error: fetchError } = await supabase
      .from('stripe_webhook_log')
      .select('*')
      .eq('processed', false);

    if (fetchError) {
      console.error('Error fetching webhook logs:', fetchError); // Debug log
      return new Response(JSON.stringify({
        error: fetchError.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    if (!logs || logs.length === 0) {
      console.log('No unprocessed logs found'); // Debug log
      return new Response('No unprocessed logs found', {
        status: 200
      });
    }

    console.log('Found logs:', logs); // Debug log
    const results = [];

    for (const log of logs) {
      try {
        console.log('Processing log:', log.id); // Debug log
        console.log('Payload type:', log.payload.type); // Debug log

        // Only process checkout.session.completed events
        if (log.payload.type !== 'checkout.session.completed') {
          console.log('Skipping - not checkout.session.completed'); // Debug log
          continue;
        }

        const session = log.payload.data.object;
        const customerEmail = session.customer_details?.email || session.customer_email;
        const amount_cents = session.amount_total;
        const paid_at = session.created ? new Date(session.created * 1000).toISOString() : null;
        const stripe_payment_id = session.id;

        // Log values before insert
        console.log('About to insert invoice with:', {
          user_email: customerEmail,
          amount_cents,
          paid_at,
          stripe_payment_id
        });

        // Create invoice record with only required fields
        const { error: invoiceError } = await supabase
          .from('invoices')
          .insert([
            {
              id: crypto.randomUUID(),
              user_email: customerEmail,
              amount_cents: amount_cents,
              paid_at: paid_at,
              stripe_payment_id: stripe_payment_id
            }
          ]);

        if (invoiceError) {
          console.error('Invoice insert error details:', JSON.stringify(invoiceError, null, 2));
          throw new Error(`Failed to create invoice: ${invoiceError.message}`);
        }

        // Mark webhook log as processed
        const { error: updateError } = await supabase
          .from('stripe_webhook_log')
          .update({
            processed: true
          })
          .eq('id', log.id);

        if (updateError) {
          throw new Error(`Failed to update webhook log: ${updateError.message}`);
        }

        results.push({
          success: true,
          log_id: log.id,
          message: 'Processed successfully'
        });
      } catch (error) {
        console.error('Error processing log:', log.id, error); // Debug log
        results.push({
          success: false,
          log_id: log.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return new Response(JSON.stringify({
      results
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Function error:', error); // Debug log
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
}); 