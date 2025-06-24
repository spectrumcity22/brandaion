import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

console.log('Initializing with URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    console.log('Function started'); // Debug log

    // 1. Fetch unprocessed webhook logs
    const { data: logs, error: fetchError } = await supabase
      .from('stripe_webhook_log')
      .select('*')
      .eq('processed', false);

    if (fetchError) {
      console.error('Error fetching webhook logs:', fetchError);
      return new Response(JSON.stringify({
        error: fetchError.message
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    if (!logs || logs.length === 0) {
      console.log('No unprocessed logs found');
      return new Response('No unprocessed logs found', {
        status: 200,
        headers: corsHeaders
      });
    }

    console.log('Found logs:', logs);
    const results = [];

    for (const log of logs) {
      try {
        console.log('Processing log:', log.id);
        console.log('Payload type:', log.payload.type);

        // Process both invoice.paid and checkout.session.completed events
        if (![
          'invoice.paid',
          'checkout.session.completed'
        ].includes(log.payload.type)) {
          console.log('Skipping - not a supported event type');
          continue;
        }

        const session = log.payload.data.object;
        let invoiceData = {};

        if (log.payload.type === 'invoice.paid') {
          // Handle invoice.paid event
          invoiceData = {
            id: session.id,
            user_email: session.customer_email,
            amount_cents: session.amount_paid,
            stripe_payment_id: session.id,
            paid_at: session.created ? new Date(session.created * 1000).toISOString() : null,
            billing_period_start: session.period_start ? new Date(session.period_start * 1000).toISOString() : null,
            billing_period_end: session.period_end ? new Date(session.period_end * 1000).toISOString() : null
          };
        } else if (log.payload.type === 'checkout.session.completed') {
          // Handle checkout.session.completed event
          const paidAt = session.created ? new Date(session.created * 1000) : new Date();
          const billingPeriodStart = paidAt;
          const billingPeriodEnd = new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
          
          invoiceData = {
            id: crypto.randomUUID(),
            user_email: session.customer_details?.email || session.customer_email,
            amount_cents: session.amount_total,
            stripe_payment_id: session.id,
            paid_at: paidAt.toISOString(),
            billing_period_start: billingPeriodStart.toISOString(),
            billing_period_end: billingPeriodEnd.toISOString()
          };
        }

        // Get package details based on amount
        const { data: packageData } = await supabase
          .from('packages')
          .select('*')
          .eq('amount_cents', invoiceData.amount_cents)
          .single();

        // Get user and organisation details
        const { data: userData } = await supabase
          .from('auth.users')
          .select('id')
          .eq('email', invoiceData.user_email)
          .single();

        const { data: orgData } = await supabase
          .from('client_organisation')
          .select('organisation_name')
          .eq('auth_user_id', userData?.id)
          .single();

        // Create complete invoice record - only use existing columns
        const { error: invoiceError } = await supabase
          .from('invoices')
          .insert([{
            id: invoiceData.id,
            auth_user_id: userData?.id,
            user_email: invoiceData.user_email,
            organisation: orgData?.organisation_name,
            amount_cents: invoiceData.amount_cents,
            stripe_payment_id: invoiceData.stripe_payment_id,
            billing_period_start: invoiceData.billing_period_start,
            billing_period_end: invoiceData.billing_period_end,
            paid_at: invoiceData.paid_at,
            package_tier: packageData?.tier || 'Startup',
            faq_pairs_pm: packageData?.faq_pairs_pm || 20,
            faq_per_batch: packageData?.faq_per_batch || 5,
            inserted_at: new Date().toISOString(),
            sent_to_schedule: false
          }]);

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
          event_type: log.payload.type,
          message: 'Processed successfully'
        });

        console.log(`✅ Processed ${log.payload.type} event for ${invoiceData.user_email}`);

      } catch (error) {
        console.error('Error processing log:', log.id, error);
        results.push({
          success: false,
          log_id: log.id,
          event_type: log.payload.type,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return new Response(JSON.stringify({
      results,
      total_processed: results.filter((r) => r.success).length,
      total_failed: results.filter((r) => !r.success).length
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: corsHeaders,
      status: 500
    });
  }
}); 