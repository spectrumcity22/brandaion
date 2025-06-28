import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase client
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { message, agentId, userId } = await request.json();
    
    if (!message || !agentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get user's brand and product context for better responses
    const { data: userContext } = await supabase
      .from('client_configuration')
      .select(`
        brand_name,
        product_name,
        market_name,
        audience_name,
        brand_jsonld_object,
        schema_json
      `)
      .eq('auth_user_id', user.id)
      .maybeSingle();

    // Prepare context for the AI agent
    let contextPrompt = '';
    if (userContext) {
      contextPrompt = `\n\nUser Context:
- Brand: ${userContext.brand_name || 'Not specified'}
- Product: ${userContext.product_name || 'Not specified'}
- Market: ${userContext.market_name || 'Not specified'}
- Target Audience: ${userContext.audience_name || 'Not specified'}

Please consider this context when providing your response.`;
    }

    // Call Perplexity API with the agent
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: `You are a helpful AI assistant specializing in business strategy, FAQ content creation, and brand optimization. You have access to the user's business context to provide personalized advice.${contextPrompt}`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
        top_p: 0.9,
        top_k: 50,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
        stream: false
      })
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error('Perplexity API error:', perplexityResponse.status, errorText);
      throw new Error(`Perplexity API error: ${perplexityResponse.status}`);
    }

    const perplexityData = await perplexityResponse.json();
    const aiResponse = perplexityData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Store the conversation in Supabase (optional - for future features)
    const { error: dbError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: user.id,
        message: message,
        response: aiResponse,
        agent_id: agentId,
        created_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('Database error:', dbError);
      // Don't fail the request if database storage fails
    }

    return NextResponse.json({
      response: aiResponse,
      success: true
    });

  } catch (error) {
    console.error('Chat agent error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
} 