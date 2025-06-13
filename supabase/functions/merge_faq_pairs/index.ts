import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }
    const { auth_user_id } = await req.json();
    if (!auth_user_id) {
      return new Response(JSON.stringify({ error: "Missing auth_user_id" }), { status: 400 });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get client configuration for this user
    const { data: config, error: configError } = await supabase
      .from("client_configuration")
      .select("*")
      .eq("auth_user_id", auth_user_id)
      .single();
    if (configError || !config) {
      return new Response(JSON.stringify({ error: "No client configuration found" }), { status: 404 });
    }

    // 2. Get all schedule rows for this user that haven't been processed
    const { data: schedules, error: scheduleError } = await supabase
      .from("schedule")
      .select("*")
      .eq("auth_user_id", auth_user_id)
      .eq("sent_for_processing", false);
    if (scheduleError) {
      return new Response(JSON.stringify({ error: scheduleError.message }), { status: 500 });
    }
    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ message: "No unprocessed schedule rows found" }), { status: 200 });
    }

    // 3. For each schedule row, insert into construct_faq_pairs
    const inserts = schedules.map((s: any) => ({
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
    }));
    const { error: insertError } = await supabase
      .from("construct_faq_pairs")
      .insert(inserts);
    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
    }

    // 4. Update schedule rows to sent_for_processing = TRUE
    const { error: updateError } = await supabase
      .from("schedule")
      .update({ sent_for_processing: true })
      .eq("auth_user_id", auth_user_id)
      .eq("sent_for_processing", false);
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ message: "FAQ pairs constructed and schedule updated." }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), { status: 500 });
  }
}); 