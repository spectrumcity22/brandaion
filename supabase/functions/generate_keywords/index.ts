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
    
    // Parse request body
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
    
    const { schema_json } = requestData
    console.log('Extracted schema_json:', schema_json)
    
    if (!schema_json) {
      console.log('Missing schema_json field')
      throw new Error('Missing required field: schema_json')
    }
    
    // Get user from JWT
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
    
    // Call OpenAI Assistant API
    const startTime = Date.now()
    
    // Create a thread
    const threadResponse = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      }
    })
    
    if (!threadResponse.ok) {
      const errorText = await threadResponse.text()
      console.error('OpenAI Thread creation error:', threadResponse.status, errorText)
      throw new Error(`OpenAI Thread creation error: ${threadResponse.status} - ${errorText}`)
    }
    
    const threadData = await threadResponse.json()
    const threadId = threadData.id
    console.log('Created thread:', threadId)
    
    // Add message to thread
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        role: 'user',
        content: `You are a keyword generation specialist for FAQ management software. Your task is to analyze product data and generate highly relevant SEO keywords.

CORE INSTRUCTIONS:
1. Generate exactly 15-20 keywords that potential customers would search for when looking for FAQ management tools
2. Focus on the actual functionality: FAQ creation, management, AI-powered question generation, customer support optimization
3. Include both broad terms (like "FAQ management") and specific feature terms (like "AI question generation")
4. Consider the target audience: customer support teams, marketing teams, business owners
5. Format your response as a clean list with just the keywords, separated by commas
6. Do NOT include explanations, categories, or additional text - just the keywords

PRODUCT FUNCTIONALITY:
- AI-powered FAQ management system
- Create and organize FAQ pairs (questions and answers)
- AI brand analysis to generate relevant questions
- Review and approval workflow for FAQ content
- Performance tracking and monthly reporting
- Customer support and SEO optimization through better FAQ content

PRODUCT DATA:
${JSON.stringify(schema_json, null, 2)}

Generate your keywords now, formatted as a comma-separated list only.`
      })
    })
    
    if (!messageResponse.ok) {
      const errorText = await messageResponse.text()
      console.error('OpenAI Message creation error:', messageResponse.status, errorText)
      throw new Error(`OpenAI Message creation error: ${messageResponse.status} - ${errorText}`)
    }
    
    const messageData = await messageResponse.json()
    console.log('Added message to thread')
    
    // Run the assistant
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        assistant_id: 'asst_cLjF4g5pgCrXFRVofJM6oscp'
      })
    })
    
    if (!runResponse.ok) {
      const errorText = await runResponse.text()
      console.error('OpenAI Run creation error:', runResponse.status, errorText)
      throw new Error(`OpenAI Run creation error: ${runResponse.status} - ${errorText}`)
    }
    
    const runData = await runResponse.json()
    const runId = runData.id
    console.log('Started run:', runId)
    
    // Poll for completion
    let runStatus = 'queued'
    let attempts = 0
    const maxAttempts = 30 // 30 seconds max wait
    
    while (runStatus !== 'completed' && runStatus !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
      attempts++
      
      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      })
      
      if (!statusResponse.ok) {
        throw new Error(`Failed to check run status: ${statusResponse.status}`)
      }
      
      const statusData = await statusResponse.json()
      runStatus = statusData.status
      console.log(`Run status (attempt ${attempts}):`, runStatus)
    }
    
    if (runStatus !== 'completed') {
      throw new Error(`Run did not complete. Final status: ${runStatus}`)
    }
    
    // Get the response messages
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    })
    
    if (!messagesResponse.ok) {
      const errorText = await messagesResponse.text()
      console.error('OpenAI Messages fetch error:', messagesResponse.status, errorText)
      throw new Error(`OpenAI Messages fetch error: ${messagesResponse.status} - ${errorText}`)
    }
    
    const messagesData = await messagesResponse.json()
    const assistantMessage = messagesData.data.find((msg: any) => msg.role === 'assistant')
    
    if (!assistantMessage) {
      throw new Error('No assistant response found')
    }
    
    const keywords = assistantMessage.content[0]?.text?.value || ''
    const responseTime = Date.now() - startTime
    
    console.log('Generated keywords:', keywords)
    
    return new Response(JSON.stringify({
      success: true,
      keywords: keywords,
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
    console.error('Generate keywords error:', error)
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