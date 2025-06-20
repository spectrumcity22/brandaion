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
    const { unique_batch_id, auth_user_id } = await req.json().catch(() => ({}));
    
    if (!unique_batch_id || !auth_user_id) {
      return new Response(JSON.stringify({ error: 'Missing unique_batch_id or auth_user_id' }), {
        headers: corsHeaders,
        status: 400
      });
    }

    console.log(`Generating FAQ batch for batch ID: ${unique_batch_id}`);

    // 1. Get all approved questions for this batch from review_questions
    const { data: questions, error: questionsError } = await supabase
      .from('review_questions')
      .select('*')
      .eq('unique_batch_id', unique_batch_id)
      .eq('auth_user_id', auth_user_id)
      .eq('answer_status', 'approved') // Look for approved status
      .not('ai_response_answers', 'is', null)
      .order('id');

    if (questionsError) {
      throw new Error(`Error fetching questions: ${questionsError.message}`);
    }

    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ error: 'No approved questions found for this batch' }), {
        headers: corsHeaders,
        status: 404
      });
    }

    // 2. Validate batch completion
    const expectedCount = questions[0].batch_faq_pairs;
    if (questions.length !== parseInt(expectedCount)) {
      return new Response(JSON.stringify({ 
        error: `Batch incomplete. Expected ${expectedCount} questions, found ${questions.length}` 
      }), {
        headers: corsHeaders,
        status: 400
      });
    }

    // 3. Build the rich FAQ pairs object for LLM discovery
    const firstQuestion = questions[0];
    
    // Extract industry from organisation_jsonld_object
    let industry = null;
    if (firstQuestion.organisation_jsonld_object) {
      try {
        const orgJsonld = typeof firstQuestion.organisation_jsonld_object === 'string' 
          ? JSON.parse(firstQuestion.organisation_jsonld_object) 
          : firstQuestion.organisation_jsonld_object;
        
        // Try to extract industry from various possible locations in the JSON-LD
        industry = orgJsonld.industry || 
                   orgJsonld['@industry'] || 
                   orgJsonld.sector || 
                   orgJsonld['@sector'] ||
                   orgJsonld.businessType ||
                   orgJsonld['@businessType'];
      } catch (error) {
        console.warn('Failed to parse organisation_jsonld_object:', error);
      }
    }
    
    // Fallback to market_name if industry not found in JSON-LD
    if (!industry) {
      industry = firstQuestion.market_name;
    }
    
    const faqPairsObject = {
      batchNo: `BatchCluster:${firstQuestion.unique_batch_cluster}`,
      batchDispatchDate: firstQuestion.batch_date,
      uniqueBatchId: firstQuestion.unique_batch_id,
      faqCountInBatch: parseInt(firstQuestion.batch_faq_pairs),
      organisation: firstQuestion.organisation,
      industry: industry,
      subCategory: firstQuestion.market_name, // Using market_name as subcategory
      audience: firstQuestion.audience_name,
      brand: firstQuestion.persona_name, // Using persona_name as brand
      product: firstQuestion.product_name,
      productDescription: null, // Not available in review_questions
      productKeywords: null, // Not available in review_questions
      answers: questions.map(q => ({
        topic: q.topic,
        question: q.question,
        answer: q.ai_response_answers
      })),
      productSchema: firstQuestion.product_jsonld_object ? 
        (typeof firstQuestion.product_jsonld_object === 'string' 
          ? JSON.parse(firstQuestion.product_jsonld_object) 
          : firstQuestion.product_jsonld_object) : null,
      "product persona": firstQuestion.persona_jsonld ? 
        (typeof firstQuestion.persona_jsonld === 'string' 
          ? JSON.parse(firstQuestion.persona_jsonld) 
          : firstQuestion.persona_jsonld) : null,
      "organisation_jsonld": firstQuestion.organisation_jsonld_object ? 
        (typeof firstQuestion.organisation_jsonld_object === 'string' 
          ? JSON.parse(firstQuestion.organisation_jsonld_object) 
          : firstQuestion.organisation_jsonld_object) : {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": firstQuestion.organisation
      }
    };

    // 4. Check if batch already exists
    const { data: existingBatch } = await supabase
      .from('batch_faq_pairs')
      .select('id')
      .eq('unique_batch_id', unique_batch_id)
      .eq('auth_user_id', auth_user_id)
      .single();

    if (existingBatch) {
      // Update existing batch
      const { error: updateError } = await supabase
        .from('batch_faq_pairs')
        .update({
          unique_batch_cluster: firstQuestion.unique_batch_cluster,
          batch_date: firstQuestion.batch_date,
          organisation: firstQuestion.organisation,
          brand: firstQuestion.persona_name,
          product: firstQuestion.product_name,
          audience: firstQuestion.audience_name,
          faq_count_in_batch: parseInt(firstQuestion.batch_faq_pairs),
          faq_pairs_object: faqPairsObject,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingBatch.id);

      if (updateError) {
        throw new Error(`Error updating batch: ${updateError.message}`);
      }

      console.log(`Updated existing FAQ batch: ${unique_batch_id}`);
    } else {
      // Insert new batch
      const { error: insertError } = await supabase
        .from('batch_faq_pairs')
        .insert({
          unique_batch_id: firstQuestion.unique_batch_id,
          unique_batch_cluster: firstQuestion.unique_batch_cluster,
          batch_date: firstQuestion.batch_date,
          organisation: firstQuestion.organisation,
          brand: firstQuestion.persona_name,
          product: firstQuestion.product_name,
          audience: firstQuestion.audience_name,
          faq_count_in_batch: parseInt(firstQuestion.batch_faq_pairs),
          faq_pairs_object: faqPairsObject,
          auth_user_id: auth_user_id
        });

      if (insertError) {
        throw new Error(`Error inserting batch: ${insertError.message}`);
      }

      console.log(`Created new FAQ batch: ${unique_batch_id}`);
    }

    return new Response(JSON.stringify({ 
      message: 'FAQ batch generated successfully',
      batchId: unique_batch_id,
      faqCount: questions.length,
      faqPairsObject: faqPairsObject
    }), {
      headers: corsHeaders,
      status: 200
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating FAQ batch:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: corsHeaders,
      status: 500
    });
  }
}); 