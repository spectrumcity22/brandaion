import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CreateScheduleRequest {
  invoice_id: string;
}

serve(async (req: Request) => {
  try {
    const { invoice_id } = await req.json() as CreateScheduleRequest;

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      throw new Error(`Invoice not found: ${invoiceError?.message}`);
    }

    // Get organisation_id from client_organisation
    const { data: org, error: orgError } = await supabase
      .from('client_organisation')
      .select('id')
      .eq('auth_user_id', invoice.auth_user_id)
      .single();

    if (orgError || !org) {
      throw new Error(`Organisation not found: ${orgError?.message}`);
    }

    // Calculate batch dates (spread evenly across the billing period)
    const startDate = new Date(invoice.billing_period_start);
    const endDate = new Date(invoice.billing_period_end);
    const periodDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const batchInterval = Math.floor(periodDays / 4); // 4 batches per period

    // Generate a unique batch cluster ID for this set of batches
    const batchClusterId = crypto.randomUUID();

    // Create 4 schedule records, one for each batch
    const scheduleRecords = [];
    for (let i = 0; i < 4; i++) {
      const batchDate = new Date(startDate);
      batchDate.setDate(batchDate.getDate() + (batchInterval * i));
      
      scheduleRecords.push({
        auth_user_id: invoice.auth_user_id,
        organisation_id: org.id,
        unique_batch_cluster: batchClusterId,
        unique_batch_id: crypto.randomUUID(),
        batch_date: batchDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD format
        batch_faq_pairs: invoice.faq_per_batch,
        total_faq_pairs: invoice.faq_pairs_pm,
        sent_for_processing: false
      });
    }

    // Insert all schedule records
    const { error: scheduleError } = await supabase
      .from('schedule')
      .insert(scheduleRecords);

    if (scheduleError) {
      throw new Error(`Failed to create schedules: ${scheduleError.message}`);
    }

    // Update invoice as sent to schedule
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ sent_to_schedule: true })
      .eq('id', invoice_id);

    if (updateError) {
      throw new Error(`Failed to update invoice: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Schedules created successfully',
      batch_cluster_id: batchClusterId
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}); 