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
    
    const { query, product_name } = requestData
    console.log('Extracted fields:', {
      query,
      product_name
    })
    
    if (!query || !product_name) {
      console.log('Missing fields - query:', !!query, 'product_name:', !!product_name)
      throw new Error('Missing required fields: query and product_name')
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
    const analysisQuery = `You are an intelligent product analysis agent with deep market knowledge. Your task is to analyze the provided URL and extract structured insights, using your knowledge to fill gaps when information isn't explicitly stated on the page.

CRITICAL RULES:
1. Visit and analyze the exact URL provided first
2. Use your market knowledge to fill gaps when information is missing
3. Return ONLY the 5 specified fields in exact format - no JSON, no explanations, no commentary
4. If the URL is not accessible, return "url_error: [error details]"
5. Do not make assumptions or search for similar products
6. DO NOT ADD ANY TEXT BEFORE OR AFTER THE 5 FIELDS - JUST THE 5 LINES
7. DO NOT USE MARKDOWN CODE BLOCKS - RETURN RAW TEXT ONLY
8. FOLLOW THE EXACT FORMATTING RULES BELOW

URL TO ANALYZE: ${query}

## STRICT FORMATTING REQUIREMENTS

### FORMAT RULES:
- Each field must be exactly: "fieldname: value"
- No extra spaces before or after the colon
- Keep each value under 150 characters
- Use semicolons (;) to separate multiple items within a field
- No commas within field values
- No special characters like %, $, @, or quotes
- No line breaks within field values
- Each field must be on its own line
- No empty lines between fields

### FIELD-SPECIFIC RULES:

**industry**: 
- Single industry or category
- Maximum 50 characters
- Example: "Automotive" or "SaaS Software"

**target_audience**: 
- 2-3 audience segments maximum
- Separate with semicolons
- Maximum 100 characters
- Example: "Small business owners; Marketing teams; Freelancers"

**value_proposition**: 
- Single clear statement
- Maximum 120 characters
- Focus on main problem solved
- Example: "Automates social media posting and analytics for small businesses"

**main_features**: 
- 3-4 key features maximum
- Separate with semicolons
- Maximum 120 characters
- Example: "Automated posting; Analytics dashboard; Team collaboration; Mobile app"

**competitors**: 
- 3-4 direct competitors maximum
- Separate with semicolons
- Maximum 100 characters
- Example: "Buffer; Hootsuite; Later; Sprout Social"

## INTELLIGENT EXTRACTION GUIDELINES

### INDUSTRY:
- Extract from page content first
- If unclear, use your knowledge of the product type and market positioning
- Choose the most specific, relevant category

### TARGET AUDIENCE:
- Identify from page messaging first
- If limited, infer from product features and use cases
- Focus on primary user segments

### VALUE PROPOSITION:
- Extract the main problem solved from page content
- If unclear, identify the core benefit based on features
- Keep it concise and focused

### MAIN FEATURES:
- List 3-4 most important features from the page
- Focus on features that drive value or solve problems
- Avoid technical jargon unless essential

### COMPETITORS:
- Look for direct competitors mentioned on the page
- If none mentioned, use your market knowledge to identify obvious alternatives
- Focus on products that solve the same problem

REQUIRED TEXT STRUCTURE:
industry: [Single industry category, max 50 chars]
target_audience: [2-3 audience segments separated by semicolons, max 100 chars]
value_proposition: [Single clear statement of main benefit, max 120 chars]
main_features: [3-4 key features separated by semicolons, max 120 chars]
competitors: [3-4 direct competitors separated by semicolons, max 100 chars]

RESPONSE FORMAT:
- Return ONLY these 5 lines in exact format
- No JSON formatting
- No additional text or explanations
- Ensure all 5 fields are present
- Use your intelligence to fill gaps, don't return "Not found"
- Follow all formatting rules strictly
- If site is not accessible, return "url_error: [error details]" as first line
- ABSOLUTELY NO TEXT BEFORE OR AFTER THE 5 LINES - PURE TEXT ONLY
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
        product_name: product_name,
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
    console.error('Perplexity product search error:', error)
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