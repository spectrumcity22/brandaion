import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@13.10.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response('No signature found', { 
        status: 400,
        headers: corsHeaders
      });
    }

    const body = await req.text();
    let event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (error: any) {
      console.error(`⚠️ Webhook signature verification failed.`, error.message);
      return new Response(`Webhook Error: ${error.message}`, { 
        status: 400,
        headers: corsHeaders
      });
    }

    // Store ONLY type and payload
    const { error: logError } = await supabase
      .from('stripe_webhook_log')
      .insert([{
        id: event.id,
        type: event.type,
        payload: event,
        processed: false
      }]);

    if (logError) {
      console.error('Error storing webhook:', JSON.stringify(logError, null, 2));
      return new Response(`Error storing webhook: ${logError.message}`, {
        status: 500,
        headers: corsHeaders
      });
    }

    console.log(`✅ Webhook stored successfully: ${event.type}`);

    return new Response(JSON.stringify({
      received: true,
      event_type: event.type
    }), {
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      },
      status: 200
    });

  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return new Response(`Webhook Error: ${error.message}`, {
      status: 400,
      headers: corsHeaders
    });
  }
}); 