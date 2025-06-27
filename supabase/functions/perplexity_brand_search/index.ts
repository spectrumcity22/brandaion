import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
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
    console.log('Extracted fields:', {
      query,
      brand_name
    })
    if (!query || !brand_name) {
      console.log('Missing fields - query:', !!query, 'brand_name:', !!brand_name)
      throw new Error('Missing required fields: query and brand_name')
    }
    // Get user from JWT - but be more flexible for testing
    const authHeader = req.headers.get('Authorization')
    let user = null
    if (authHeader) {
      try {
        const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
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
    const analysisQuery = `You are a brand analysis agent. Your ONLY task is to analyze the provided URL and return a simple text response with the EXACT format specified below.

CRITICAL RULES:
1. Visit and analyze ONLY the exact URL provided - do not search for similar brands
2. Return ONLY the 4 specified fields in exact format - no JSON, no explanations, no commentary
3. Follow the EXACT text structure below - no additional fields
4. If the URL is not accessible, return "url_error: [error details]"
5. If you cannot find specific information, use "Not found"
6. Do not make assumptions or search for similar brands
7. Do not provide generic advice or analysis methods
8. DO NOT ADD ANY TEXT BEFORE OR AFTER THE 4 FIELDS - JUST THE 4 LINES
9. DO NOT USE MARKDOWN CODE BLOCKS - RETURN RAW TEXT ONLY

URL TO ANALYZE: ${query}

REQUIRED TEXT STRUCTURE:
industry: [The industry this brand operates in]
target_audience: [Who their target audience is]
value_proposition: [Their main value proposition or what they offer]
main_services: [Service 1, Service 2, Service 3]

RESPONSE FORMAT:
- Return ONLY these 4 lines in exact format
- No JSON formatting
- No additional text or explanations
- Ensure all 4 fields are present
- Use "Not found" for missing information
- Separate multiple services with commas
- If site is not accessible, return "url_error: [error details]" as first line
- ABSOLUTELY NO TEXT BEFORE OR AFTER THE 4 LINES - PURE TEXT ONLY
- NO MARKDOWN CODE BLOCKS - RAW TEXT ONLY`

    const perplexityResponse = await fetch(`https://api.perplexity.ai/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('PERPLEXITY_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'user',
            content: analysisQuery
          }
        ],
        max_tokens: 1500,
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
    // Try to parse the response as JSON, if it fails, return as text
    let parsedData
    try {
      parsedData = JSON.parse(responseContent)
      console.log('Successfully parsed JSON response')
    } catch (parseError) {
      console.log('Failed to parse as JSON, returning as text')
      parsedData = {
        analysis: responseContent,
        brand_name: brand_name,
        query: query
      }
    }
    return new Response(JSON.stringify({
      success: true,
      data: parsedData,
      response_time_ms: responseTime,
      user_id: user?.id || 'anonymous'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    })
  } catch (error) {
    console.error('Perplexity brand search error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    })
  }
}) 