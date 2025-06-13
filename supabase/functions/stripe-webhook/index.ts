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

interface StripeEvent {
  type: string;
  data: {
    object: {
      id: string;
      customer: string;
      customer_email: string;
      amount_paid: number;
      currency: string;
      status: string;
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
    };
  };
}

serve(async (req: Request) => {
  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response('No signature found', { status: 400 });
    }

    const body = await req.text();
    let event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error: any) {
      console.error(`⚠️ Webhook signature verification failed.`, error.message);
      return new Response(`Webhook Error: ${error.message}`, { status: 400 });
    }

    // Store the webhook in stripe_webhook_log
    const { error: logError } = await supabase
      .from('stripe_webhook_log')
      .insert([{
        payload: event,
        processed: false
      }]);

    if (logError) {
      console.error('Error storing webhook:', logError);
      return new Response('Error storing webhook', { status: 500 });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return new Response(`Webhook Error: ${error.message}`, { status: 400 });
  }
}); 