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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
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

    const { auth_user_id } = body;
    if (!auth_user_id) {
      throw new Error('auth_user_id is required');
    }

    console.log('Processing merge for auth_user_id:', auth_user_id);

    // 1. Get client configuration for this user
    const { data: config, error: configError } = await supabase
      .from('client_configuration')
      .select('*')
      .eq('auth_user_id', auth_user_id)
      .single();

    if (configError || !config) {
      throw new Error(`No client configuration found: ${configError?.message}`);
    }

    console.log('Found client configuration:', {
      product_name: config.product_name,
      persona_name: config.persona_name,
      audience_name: config.audience_name,
      market_name: config.market_name
    });

    // 2. Get all schedule rows for this user that haven't been processed
    const { data: schedules, error: scheduleError } = await supabase
      .from('schedule')
      .select('*')
      .eq('auth_user_id', auth_user_id)
      .eq('sent_for_processing', false);

    if (scheduleError) {
      throw new Error(`Error fetching schedules: ${scheduleError.message}`);
    }

    if (!schedules || schedules.length === 0) {
      console.log('No unprocessed schedule rows found for user:', auth_user_id);
      return new Response(JSON.stringify({
        success: true,
        message: 'No unprocessed schedule rows found',
        processed_count: 0
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }

    console.log(`Found ${schedules.length} unprocessed schedule rows`);

    // 3. For each schedule row, insert into construct_faq_pairs
    const inserts = schedules.map((s) => ({
      unique_batch_cluster: s.unique_batch_cluster,
      unique_batch_id: s.unique_batch_id,
      batch_date: s.batch_date,
      batch_faq_pairs: s.batch_faq_pairs,
      total_faq_pairs: s.total_faq_pairs,
      organisation: s.organisation,
      user_email: s.user_email,
      auth_user_id: s.auth_user_id,
      organisation_id: s.organisation_id,
      product_name: config.product_name,
      persona_name: config.persona_name,
      audience_name: config.audience_name,
      market_name: config.market_name,
      brand_jsonld_object: config.brand_jsonld_object,
      product_jsonld_object: config.schema_json,
      persona_jsonld: config.persona_jsonld,
      organisation_jsonld_object: config.organisation_jsonld_object,
      question_status: 'pending' // Use question_status instead of generation_status
    }));

    console.log(`Inserting ${inserts.length} FAQ pairs into construct_faq_pairs`);

    const { error: insertError } = await supabase
      .from('construct_faq_pairs')
      .insert(inserts);

    if (insertError) {
      throw new Error(`Failed to insert FAQ pairs: ${insertError.message}`);
    }

    console.log('Successfully inserted FAQ pairs');

    // 4. Update schedule rows to sent_for_processing = TRUE
    const { error: updateError } = await supabase
      .from('schedule')
      .update({ sent_for_processing: true })
      .eq('auth_user_id', auth_user_id)
      .eq('sent_for_processing', false);

    if (updateError) {
      throw new Error(`Failed to update schedule rows: ${updateError.message}`);
    }

    console.log('Successfully updated schedule rows to sent_for_processing = true');

    return new Response(JSON.stringify({
      success: true,
      message: 'FAQ pairs constructed and schedule updated successfully',
      processed_count: schedules.length,
      schedule_ids: schedules.map(s => s.id)
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });

  } catch (error) {
    console.error('Error in merge function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
