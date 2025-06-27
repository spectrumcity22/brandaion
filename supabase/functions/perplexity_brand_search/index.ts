import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BrandSearchRequest {
  query: string;
  brand_name: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Debug: Log the raw request body
    const rawBody = await req.text()
    console.log('Raw request body:', rawBody)
    
    let requestData
    try {
      requestData = JSON.parse(rawBody)
      console.log('Parsed request data:', requestData)
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError)
      throw new Error('Invalid JSON in request body')
    }

    const { query, brand_name } = requestData

    console.log('Extracted fields:', { query, brand_name })

    if (!query || !brand_name) {
      console.log('Missing fields - query:', !!query, 'brand_name:', !!brand_name)
      throw new Error('Missing required fields: query and brand_name')
    }

    // Get user from JWT - but be more flexible for testing
    const authHeader = req.headers.get('Authorization')
    let user = null
    
    if (authHeader) {
      try {
        const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser(
          authHeader.replace('Bearer ', '')
        )
        
        if (!authError && authUser) {
          user = authUser
          console.log('Authenticated user:', user.id)
        } else {
          console.log('Auth error or no user, continuing without user context')
        }
      } catch (authError) {
        console.log('Authentication failed, continuing without user context:', authError)
      }
    } else {
      console.log('No authorization header provided')
    }

    // Call Perplexity API
    const startTime = Date.now()
    
    const perplexityResponse = await fetch(`https://api.perplexity.ai/chat/completions`, {
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
            content: query
          }
        ],
        max_tokens: 4000,
        temperature: 0.1
      })
    })

    const responseTime = Date.now() - startTime

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text()
      console.error('Perplexity API error:', perplexityResponse.status, errorText)
      throw new Error(`Perplexity API error: ${perplexityResponse.status} - ${errorText}`)
    }

    const perplexityData = await perplexityResponse.json()
    const responseContent = perplexityData.choices[0]?.message?.content

    if (!responseContent) {
      throw new Error('No response content from Perplexity')
    }

    // Return the raw text analysis
    const analysisData = {
      analysis: responseContent,
      brand_name: brand_name,
      query: query
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: analysisData,
        response_time_ms: responseTime,
        user_id: user?.id || 'anonymous'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Perplexity brand search error:', error)

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