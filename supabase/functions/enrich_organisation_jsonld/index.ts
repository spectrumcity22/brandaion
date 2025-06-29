import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { auth_user_id, client_organisation_id } = await req.json();

    if (!auth_user_id && !client_organisation_id) {
      return new Response(JSON.stringify({ 
        error: 'Either auth_user_id or client_organisation_id is required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Determine which client to work with
    let targetAuthUserId = auth_user_id;
    let targetOrgId = client_organisation_id;

    if (!targetAuthUserId && targetOrgId) {
      // Get auth_user_id from client_organisation_id
      const { data: org, error: orgError } = await supabase
        .from('client_organisation')
        .select('auth_user_id')
        .eq('id', targetOrgId)
        .single();

      if (orgError) {
        throw new Error(`Failed to find organization: ${orgError.message}`);
      }
      targetAuthUserId = org.auth_user_id;
    } else if (targetAuthUserId && !targetOrgId) {
      // Get client_organisation_id from auth_user_id
      const { data: org, error: orgError } = await supabase
        .from('client_organisation')
        .select('id')
        .eq('auth_user_id', targetAuthUserId)
        .single();

      if (orgError) {
        throw new Error(`Failed to find organization: ${orgError.message}`);
      }
      targetOrgId = org.id;
    }

    console.log(`Enriching organization JSON-LD for auth_user_id: ${targetAuthUserId}, org_id: ${targetOrgId}`);

    // 1. Get the base organization JSON-LD
    const { data: org, error: orgError } = await supabase
      .from('client_organisation')
      .select('organisation_jsonld_object, organisation_name, industry, subcategory')
      .eq('id', targetOrgId)
      .single();

    if (orgError) {
      throw new Error(`Failed to fetch organization: ${orgError.message}`);
    }

    // 2. Get all brands for this organization
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('id, brand_name, brand_jsonld_object')
      .eq('auth_user_id', targetAuthUserId);

    if (brandsError) {
      throw new Error(`Failed to fetch brands: ${brandsError.message}`);
    }

    // 3. Get all products for this organization
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, product_name, schema_json')
      .eq('auth_user_id', targetAuthUserId);

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`);
    }

    // 4. Get all FAQ topics (from review_questions)
    const { data: topics, error: topicsError } = await supabase
      .from('review_questions')
      .select('topic')
      .eq('auth_user_id', targetAuthUserId)
      .not('topic', 'is', null);

    if (topicsError) {
      throw new Error(`Failed to fetch topics: ${topicsError.message}`);
    }

    // Helper function to safely parse JSON
    const safeJsonParse = (data: any) => {
      if (!data) return null;
      if (typeof data === 'object') return data;
      if (typeof data === 'string') {
        try {
          return JSON.parse(data);
        } catch (error) {
          console.warn('Failed to parse JSON string:', error);
          return null;
        }
      }
      return null;
    };

    // 5. Build the enriched organization JSON-LD
    const baseOrgJsonld = safeJsonParse(org.organisation_jsonld_object) || {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": org.organisation_name,
      "industry": org.industry || "",
      "subcategory": org.subcategory || ""
    };

    // Extract unique topics
    const topicSet = new Set<string>();
    topics?.forEach(t => {
      if (t.topic) topicSet.add(t.topic);
    });
    const uniqueTopics = Array.from(topicSet);

    // Filter out FAQ Q&As from base organization JSON-LD
    const { 
      "@context": context,
      "@type": type,
      "name": name,
      "industry": industry,
      "subcategory": subcategory,
      // Explicitly exclude FAQ-related fields
      "faqs": _faqs,
      "faq": _faq,
      "questions": _questions,
      "answers": _answers,
      "faq_pairs": _faq_pairs,
      "batch_faq_pairs": _batch_faq_pairs,
      // Keep all other fields except FAQ-related ones
      ...otherFields
    } = baseOrgJsonld;

    // Build enriched object without FAQ Q&As
    const enrichedOrgJsonld = {
      "@context": context,
      "@type": type,
      "name": name,
      "industry": industry || "",
      "subcategory": subcategory || "",
      ...otherFields,
      "brands": brands?.map(brand => ({
        "@type": "Brand",
        "name": brand.brand_name,
        "brandId": brand.id,
        "brandJsonld": safeJsonParse(brand.brand_jsonld_object)
      })) || [],
      "products": products?.map(product => ({
        "@type": "Product",
        "name": product.product_name,
        "productId": product.id,
        "url": safeJsonParse(product.schema_json)?.url || "",
        "description": safeJsonParse(product.schema_json)?.description || ""
      })) || [],
      "topics": uniqueTopics,
      "topicCount": uniqueTopics.length,
      "brandCount": brands?.length || 0,
      "productCount": products?.length || 0,
      "enrichedAt": new Date().toISOString(),
      "enrichedBy": "enrich_organisation_jsonld_function"
    };

    // 6. Update the llm_discovery_static table
    const { error: updateError } = await supabase
      .from('llm_discovery_static')
      .upsert({
        auth_user_id: targetAuthUserId,
        client_organisation_id: targetOrgId,
        organisation_jsonld_enriched: enrichedOrgJsonld,
        last_generated: new Date().toISOString()
      }, {
        onConflict: 'auth_user_id,client_organisation_id'
      });

    if (updateError) {
      throw new Error(`Failed to update enriched JSON-LD: ${updateError.message}`);
    }

    console.log(`Successfully enriched organization JSON-LD for ${org.organisation_name}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Organization JSON-LD enriched successfully',
      organization: org.organisation_name,
      enrichedData: {
        brandsCount: brands?.length || 0,
        productsCount: products?.length || 0,
        topicsCount: uniqueTopics.length,
        enrichedAt: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in enrich_organisation_jsonld function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
}); 