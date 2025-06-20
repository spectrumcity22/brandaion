import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    // Verify JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the token using Supabase auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Invalid JWT token');
    }

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

    // Verify that the auth_user_id matches the JWT token
    if (user.id !== auth_user_id) {
      throw new Error('auth_user_id does not match JWT token');
    }

    console.log('Processing merge for auth_user_id:', auth_user_id);

    // First, get the end_user record
    const { data: endUser, error: endUserError } = await supabase
      .from('end_users')
      .select('id')
      .eq('auth_user_id', auth_user_id)
      .single();

    if (endUserError || !endUser) {
      throw new Error(`No end_user found for auth_user_id: ${endUserError?.message}`);
    }

    console.log('Found end_user:', endUser);

    // 1. Get client configuration for this user
    const { data: config, error: configError } = await supabase
      .from('client_configuration')
      .select('*')
      .eq('auth_user_id', auth_user_id)
      .single();

    if (configError || !config) {
      throw new Error(`No client configuration found: ${configError?.message}`);
    }

    // 2. Get all schedule rows for this user that haven't been processed
    const { data: schedules, error: scheduleError } = await supabase
      .from('schedule')
      .select('*')
      .eq('auth_user_id', endUser.id)  // Use end_users.id instead of auth_user_id
      .eq('sent_for_processing', false);

    if (scheduleError) {
      throw new Error(`Error fetching schedules: ${scheduleError.message}`);
    }

    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No unprocessed schedule rows found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // 3. For each schedule row, update existing construct_faq_pairs
    for (const schedule of schedules) {
      // Find existing row
      const { data: existingRow, error: findError } = await supabase
        .from('construct_faq_pairs')
        .select('*')
        .eq('unique_batch_id', schedule.unique_batch_id)
        .single();

      if (findError && findError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw new Error(`Error finding existing FAQ pair: ${findError.message}`);
      }

      if (!existingRow) {
        // Create new row if it doesn't exist
        const { error: insertError } = await supabase
          .from('construct_faq_pairs')
          .insert({
            unique_batch_cluster: schedule.unique_batch_cluster,
            unique_batch_id: schedule.unique_batch_id,
            batch_date: schedule.batch_date,
            batch_faq_pairs: schedule.batch_faq_pairs,
            total_faq_pairs: schedule.total_faq_pairs,
            organisation: schedule.organisation,
            user_email: schedule.user_email,
            auth_user_id: schedule.auth_user_id,
            organisation_id: schedule.organisation_id,
            product_name: config.product_name,
            persona_name: config.persona_name,
            audience_name: config.audience_name,
            market_name: config.market_name,
            brand_jsonld_object: config.brand_jsonld_object,
            product_jsonld_object: config.schema_json,
            persona_jsonld: config.persona_jsonld,
            ai_request_for_questions: config.brand_jsonld_object,
            generation_status: 'pending'
          });

        if (insertError) {
          console.error(`Failed to create FAQ pair for batch ${schedule.unique_batch_id}:`, insertError);
          continue;
        }
      } else {
        // Update existing row with client configuration
        const { error: updateError } = await supabase
          .from('construct_faq_pairs')
          .update({
            product_name: config.product_name,
            persona_name: config.persona_name,
            audience_name: config.audience_name,
            market_name: config.market_name,
            brand_jsonld_object: config.brand_jsonld_object,
            product_jsonld_object: config.schema_json,
            persona_jsonld: config.persona_jsonld,
            ai_request_for_questions: config.brand_jsonld_object,
            generation_status: 'pending'
          })
          .eq('id', existingRow.id);

        if (updateError) {
          console.error(`Failed to update FAQ pair ${existingRow.id}:`, updateError);
          continue;
        }
      }
    }

    // 4. Update schedule rows to sent_for_processing = TRUE
    const { error: updateError } = await supabase
      .from('schedule')
      .update({ sent_for_processing: true })
      .eq('auth_user_id', endUser.id)  // Use end_users.id instead of auth_user_id
      .eq('sent_for_processing', false);

    if (updateError) {
      throw new Error(`Failed to update schedule rows: ${updateError.message}`);
    }

    // 5. Trigger the open_ai_request_questions function
    const generateResponse = await fetch("https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/open_ai_request_questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "x-client-info": "supabase-js/2.39.3",
        "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      },
      body: JSON.stringify({ auth_user_id: auth_user_id }),
    });

    if (!generateResponse.ok) {
      console.error("Failed to trigger FAQ generation:", await generateResponse.text());
      // Don't throw error here, as the FAQ pairs were still created successfully
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'FAQ pairs constructed, schedule updated, and generation triggered'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('Error in merge function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
}); 