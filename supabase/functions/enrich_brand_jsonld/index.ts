import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { auth_user_id, brand_id } = await req.json();

    if (!auth_user_id || !brand_id) {
      return new Response(JSON.stringify({ 
        error: 'Both auth_user_id and brand_id are required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`Enriching brand JSON-LD for auth_user_id: ${auth_user_id}, brand_id: ${brand_id}`);

    // 1. Get the base brand JSON-LD
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('brand_jsonld_object, brand_name, brand_url, organisation_name, ai_response')
      .eq('id', brand_id)
      .eq('auth_user_id', auth_user_id)
      .single();

    if (brandError) {
      throw new Error(`Failed to fetch brand: ${brandError.message}`);
    }

    // 2. Get all products for this brand
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, product_name, description, url, schema_json, keywords')
      .eq('brand_id', brand_id)
      .eq('auth_user_id', auth_user_id);

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`);
    }

    // 3. Get all FAQ objects for products of this brand
    const { data: faqObjects, error: faqError } = await supabase
      .from('llm_discovery_faq_objects')
      .select('id, product_id, faq_json_object, week_start_date')
      .in('product_id', products?.map(p => p.id) || []);

    if (faqError) {
      console.warn('Could not fetch FAQ objects:', faqError.message);
    }

    // 4. Get organization details
    const { data: org, error: orgError } = await supabase
      .from('client_organisation')
      .select('organisation_name, industry, subcategory')
      .eq('auth_user_id', auth_user_id)
      .single();

    if (orgError) {
      console.warn('Could not fetch organization details:', orgError.message);
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

    // 5. Build the enriched brand JSON-LD
    const baseBrandJsonld = safeJsonParse(brand.brand_jsonld_object) || {
      "@context": "https://schema.org",
      "@type": "Brand",
      "name": brand.brand_name,
      "url": brand.brand_url || "",
      "parentOrganization": {
        "@type": "Organization",
        "name": org?.organisation_name || brand.organisation_name || ""
      }
    };

    // Process products with their FAQs
    const enrichedProducts = products?.map(product => {
      const productFaqs = faqObjects?.filter(faq => faq.product_id === product.id) || [];
      
      return {
        "@type": "Product",
        "name": product.product_name,
        "productId": product.id,
        "description": product.description || "",
        "url": product.url || "",
        "keywords": product.keywords || "",
        "productJsonld": safeJsonParse(product.schema_json),
        "faqs": productFaqs.map(faq => ({
          "@type": "FAQPage",
          "faqId": faq.id,
          "weekStartDate": faq.week_start_date,
          "faqJsonld": safeJsonParse(faq.faq_json_object)
        })),
        "faqCount": productFaqs.length
      };
    }) || [];

    // Build enriched object
    const enrichedBrandJsonld = {
      ...baseBrandJsonld,
      "products": enrichedProducts,
      "productCount": products?.length || 0,
      "totalFaqCount": faqObjects?.length || 0,
      "organization": {
        "@type": "Organization",
        "name": org?.organisation_name || brand.organisation_name || "",
        "industry": org?.industry || "",
        "subcategory": org?.subcategory || ""
      },
      "enrichedAt": new Date().toISOString(),
      "enrichedBy": "enrich_brand_jsonld_function"
    };

    // 6. Update the llm_discovery_static table
    const { error: updateError } = await supabase
      .from('llm_discovery_static')
      .upsert({
        auth_user_id: auth_user_id,
        brand_jsonld_enriched: enrichedBrandJsonld,
        last_generated: new Date().toISOString()
      }, {
        onConflict: 'auth_user_id'
      });

    if (updateError) {
      throw new Error(`Failed to update enriched brand JSON-LD: ${updateError.message}`);
    }

    console.log(`Successfully enriched brand JSON-LD for ${brand.brand_name}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Brand JSON-LD enriched successfully',
      brand: brand.brand_name,
      enrichedData: {
        productsCount: products?.length || 0,
        faqsCount: faqObjects?.length || 0,
        enrichedAt: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in enrich_brand_jsonld function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
}); 