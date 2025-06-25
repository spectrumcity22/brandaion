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

    // Get invoice details
    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .eq('sent_to_schedule', false)
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

    // Get organisation details
    const { data: org, error: orgError } = await supabase
      .from('client_organisation')
      .select('id, organisation_name')
      .eq('auth_user_id', invoice.auth_user_id)
      .single();

    console.log('Organisation data:', org);
    console.log('Organisation error:', orgError);

    if (orgError || !org) {
      throw new Error(`Organisation not found: ${orgError?.message}`);
    }

    // Get the correct end_user_id for this auth_user_id
    const { data: endUser, error: endUserError } = await supabase
      .from('end_users')
      .select('id')
      .eq('auth_user_id', invoice.auth_user_id)
      .single();

    if (endUserError || !endUser) {
      throw new Error(`End user not found for auth_user_id: ${invoice.auth_user_id}`);
    }

    // Calculate batch dates (4 batches per billing period)
    const startDate = new Date(invoice.billing_period_start);
    const endDate = new Date(invoice.billing_period_end);
    const periodDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const batchInterval = Math.floor(periodDays / 4);

    console.log('Batch calculation:', {
      startDate,
      endDate,
      periodDays,
      batchInterval
    });

    const batchClusterId = crypto.randomUUID();
    const scheduleRecords = [];
    for(let i = 0; i < 4; i++){
      const batchDate = new Date(startDate);
      batchDate.setDate(batchDate.getDate() + batchInterval * i);
      scheduleRecords.push({
        auth_user_id: invoice.auth_user_id,
        organisation_id: org.id,
        unique_batch_cluster: batchClusterId,
        unique_batch_id: crypto.randomUUID(),
        batch_date: batchDate.toISOString().split('T')[0],
        batch_faq_pairs: Math.floor(invoice.faq_pairs_pm / 4),
        total_faq_pairs: invoice.faq_pairs_pm,
        sent_for_processing: false,
        organisation: org.organisation_name,
        user_email: invoice.user_email
      });
    }

    console.log('Schedule records to insert:', scheduleRecords);

    // Insert the schedule records
    const { error: scheduleError } = await supabase
      .from('schedule')
      .insert(scheduleRecords);

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