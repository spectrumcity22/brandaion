import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { webhook_id } = await req.json();

    if (!webhook_id) {
      return new Response('Webhook ID required', { 
        status: 400,
        headers: corsHeaders
      });
    }

    // Get the webhook
    const { data: webhook, error: webhookError } = await supabase
      .from('stripe_webhook_log')
      .select('*')
      .eq('id', webhook_id)
      .single();

    if (webhookError || !webhook) {
      return new Response('Webhook not found', { 
        status: 404,
        headers: corsHeaders
      });
    }

    if (webhook.processed) {
      return new Response('Webhook already processed', { 
        status: 400,
        headers: corsHeaders
      });
    }

    // Process the webhook manually (same logic as trigger)
    const session = webhook.payload.data.object;
    let invoice_id: string;
    let user_email: string;
    let amount_cents: number;
    let stripe_payment_id: string;
    let paid_at: string;
    let billing_period_start: string;
    let billing_period_end: string;

    if (webhook.type === 'invoice.paid') {
      invoice_id = session.id;
      user_email = session.customer_email;
      amount_cents = session.amount_paid;
      stripe_payment_id = session.id;
      paid_at = new Date(session.created * 1000).toISOString();
      billing_period_start = new Date(session.period_start * 1000).toISOString();
      billing_period_end = new Date(session.period_end * 1000).toISOString();
    } else if (webhook.type === 'checkout.session.completed') {
      invoice_id = crypto.randomUUID();
      user_email = session.customer_details.email;
      amount_cents = session.amount_total;
      stripe_payment_id = session.id;
      paid_at = new Date(session.created * 1000).toISOString();
      billing_period_start = new Date(session.created * 1000).toISOString();
      billing_period_end = new Date((session.created + 30 * 24 * 60 * 60) * 1000).toISOString();
    } else {
      return new Response('Unsupported webhook type', { 
        status: 400,
        headers: corsHeaders
      });
    }

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert([{
        id: invoice_id,
        user_email,
        amount_cents,
        stripe_payment_id,
        billing_period_start,
        billing_period_end,
        paid_at,
        faq_pairs_pm: 20,
        faq_per_batch: 5,
        inserted_at: new Date().toISOString(),
        sent_to_schedule: false
      }])
      .select()
      .single();

    if (invoiceError) {
      return new Response(`Invoice creation failed: ${invoiceError.message}`, { 
        status: 500,
        headers: corsHeaders
      });
    }

    // Mark webhook as processed
    await supabase
      .from('stripe_webhook_log')
      .update({ processed: true })
      .eq('id', webhook_id);

    return new Response(JSON.stringify({
      success: true,
      invoice_id: invoice.id,
      user_email: invoice.user_email
    }), {
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      },
      status: 200
    });

  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: corsHeaders
    });
  }
}); 