import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CreateScheduleRequest {
  invoice_id: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse the request body
    let body;
    try {
      body = await req.json();
      console.log('Request body:', body);
    } catch (e) {
      throw new Error('Invalid JSON in request body');
    }

    const { invoice_id } = body as CreateScheduleRequest;
    if (!invoice_id) {
      throw new Error('invoice_id is required');
    }

    console.log('Processing invoice:', invoice_id);

    // Get invoice details with more specific query
    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .eq('sent_to_schedule', false)  // Only get invoices not yet sent to schedule
      .order('inserted_at', { ascending: false })
      .limit(1);

    console.log('Invoices found:', invoices);
    console.log('Invoice error:', invoiceError);

    if (invoiceError) {
      throw new Error(`Error fetching invoice: ${invoiceError.message}`);
    }

    if (!invoices || invoices.length === 0) {
      throw new Error(`No invoice found with ID: ${invoice_id}`);
    }

    const invoice = invoices[0];
    console.log('Selected invoice:', invoice);

    // Get organisation_id from client_organisation
    const { data: org, error: orgError } = await supabase
      .from('client_organisation')
      .select('id')
      .eq('auth_user_id', invoice.auth_user_id)
      .single();

    console.log('Organisation data:', org);
    console.log('Organisation error:', orgError);

    if (orgError || !org) {
      throw new Error(`Organisation not found: ${orgError?.message}`);
    }

    // Calculate batch dates (spread evenly across the billing period)
    const startDate = new Date(invoice.billing_period_start);
    const endDate = new Date(invoice.billing_period_end);
    const periodDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const batchInterval = Math.floor(periodDays / 4); // 4 batches per period

    console.log('Batch calculation:', {
      startDate,
      endDate,
      periodDays,
      batchInterval
    });

    // Create a single schedule record with all batch dates
    const scheduleRecord = {
      auth_user_id: invoice.auth_user_id,
      invoice_id: invoice.id,
      batch_1_date: new Date(startDate).toISOString(),
      batch_2_date: new Date(startDate.getTime() + batchInterval * 24 * 60 * 60 * 1000).toISOString(),
      batch_3_date: new Date(startDate.getTime() + batchInterval * 2 * 24 * 60 * 60 * 1000).toISOString(),
      batch_4_date: new Date(startDate.getTime() + batchInterval * 3 * 24 * 60 * 60 * 1000).toISOString(),
      faq_pairs_pm: invoice.faq_pairs_pm,
      faq_per_batch: invoice.faq_per_batch,
      status: 'active',
      billing_period_start: invoice.billing_period_start,
      billing_period_end: invoice.billing_period_end
    };

    console.log('Schedule record to insert:', scheduleRecord);

    // Insert the schedule record
    const { error: scheduleError } = await supabase
      .from('schedule')
      .insert(scheduleRecord);

    console.log('Schedule insert error:', scheduleError);

    if (scheduleError) {
      throw new Error(`Failed to create schedule: ${scheduleError.message}`);
    }

    // Update invoice as sent to schedule
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ sent_to_schedule: true })
      .eq('id', invoice_id);

    console.log('Invoice update error:', updateError);

    if (updateError) {
      throw new Error(`Failed to update invoice: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Schedule created successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('Error in edge function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
}); 