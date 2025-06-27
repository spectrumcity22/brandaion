import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BrandAnalysisRequest {
  brand_id: string;
  brand_url: string;
  brand_name: string;
}

interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    total_tokens: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get request data
    const { brand_id, brand_url, brand_name }: BrandAnalysisRequest = await req.json()

    if (!brand_id || !brand_url || !brand_name) {
      throw new Error('Missing required fields: brand_id, brand_url, brand_name')
    }

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    // Create initial analysis record
    const { data: analysis, error: insertError } = await supabaseClient
      .from('brand_analyses')
      .insert({
        brand_id,
        auth_user_id: user.id,
        url_analyzed: brand_url,
        analysis_status: 'processing',
        perplexity_status: 'pending'
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create analysis record: ${insertError.message}`)
    }

    // Prepare Perplexity prompt
    const perplexityPrompt = `You are analyzing a specific brand's website to create a comprehensive summary for AI-powered FAQ generation.

TASK: Analyze the EXACT URL provided and extract structured information from that specific website.

CRITICAL INSTRUCTIONS:
1. Visit and analyze ONLY the exact URL provided - do not search for similar brand names
2. If the URL is not accessible or returns an error, clearly state this
3. Focus on the actual content found on the provided website
4. Do not make assumptions or search for similar brands
5. If the site is under construction or has minimal content, note this

URL TO ANALYZE: ${brand_url}
BRAND NAME: ${brand_name}

FORMAT YOUR RESPONSE AS JSON with the following structure:
{
  "analysis_status": {
    "url_accessible": true/false,
    "error_message": "If URL not accessible",
    "content_found": true/false
  },
  "brand_identity": {
    "name": "Exact brand name from the site",
    "tagline": "Brand tagline if found",
    "mission_statement": "Mission/vision if stated",
    "industry": "Primary industry classification",
    "target_audience": "Who they serve",
    "value_proposition": "What value they provide"
  },
  "content_summary": {
    "main_products_services": ["List of main offerings"],
    "key_features": ["Key features/benefits"],
    "pricing_model": "Pricing approach if mentioned",
    "testimonials_count": 0,
    "blog_topics": ["Topics if blog exists"]
  },
  "technical_insights": {
    "meta_description": "SEO meta description",
    "primary_keywords": ["Key terms used"],
    "call_to_actions": ["Main CTAs found"],
    "contact_info": {
      "email": "Contact email",
      "phone": "Phone number",
      "social_media": ["Social links"]
    }
  },
  "customer_insights": {
    "pain_points_addressed": ["Problems they solve"],
    "solutions_offered": ["How they solve problems"],
    "benefits_highlighted": ["Benefits they emphasize"],
    "existing_faqs": ["Any existing FAQs found"]
  },
  "competitive_positioning": {
    "unique_selling_propositions": ["What makes them unique"],
    "market_differentiators": ["How they stand out"],
    "competitor_mentions": ["Competitors mentioned"]
  },
  "faq_generation_insights": {
    "potential_questions": ["Questions customers might ask"],
    "content_gaps": ["Areas needing more info"],
    "recommended_topics": ["FAQ topics to focus on"]
  }
}

IMPORTANT GUIDELINES:
- Analyze ONLY the provided URL, do not search for similar brands
- If the site is not accessible, set url_accessible: false and provide error details
- If the site has minimal content, note this in content_gaps
- Be factual and objective about what you actually find
- Focus on information that would help answer customer questions`

    // Call Perplexity API
    const startTime = Date.now()
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('PERPLEXITY_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'user',
            content: perplexityPrompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.1
      })
    })

    const responseTime = Date.now() - startTime

    if (!perplexityResponse.ok) {
      throw new Error(`Perplexity API error: ${perplexityResponse.status}`)
    }

    const perplexityData: PerplexityResponse = await perplexityResponse.json()
    const responseContent = perplexityData.choices[0]?.message?.content

    if (!responseContent) {
      throw new Error('No response content from Perplexity')
    }

    // Parse JSON response
    let parsedAnalysis
    try {
      parsedAnalysis = JSON.parse(responseContent)
    } catch (parseError) {
      throw new Error(`Failed to parse Perplexity response: ${parseError.message}`)
    }

    // Extract structured data
    const {
      brand_identity,
      content_summary,
      technical_insights,
      customer_insights,
      competitive_positioning,
      faq_generation_insights
    } = parsedAnalysis

    // Calculate cost (approximate - Perplexity pricing may vary)
    const totalTokens = perplexityData.usage?.total_tokens || 0
    const estimatedCost = (totalTokens / 1000) * 0.0005 // Approximate cost per token

    // Update analysis record with results
    const { error: updateError } = await supabaseClient
      .from('brand_analyses')
      .update({
        analysis_status: 'completed',
        perplexity_status: 'success',
        perplexity_response: parsedAnalysis,
        perplexity_cost_usd: estimatedCost,
        perplexity_response_time_ms: responseTime,
        brand_identity,
        content_summary,
        technical_insights,
        customer_insights,
        competitive_positioning,
        faq_generation_insights
      })
      .eq('id', analysis.id)

    if (updateError) {
      throw new Error(`Failed to update analysis: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis_id: analysis.id,
        message: 'Brand analysis completed successfully',
        data: {
          brand_identity,
          content_summary,
          technical_insights,
          customer_insights,
          competitive_positioning,
          faq_generation_insights
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Brand analysis error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
}) 