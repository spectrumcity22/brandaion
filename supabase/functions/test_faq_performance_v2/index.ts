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
    const { auth_user_id, question_ids, ai_providers, test_schedule = 'manual' } = await req.json()

    if (!auth_user_id || !question_ids || !ai_providers) {
      throw new Error('Missing required parameters')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get questions from database
    const { data: questions, error: questionsError } = await supabase
      .from('review_questions')
      .select('id, question, ai_response_answers')
      .in('id', question_ids)

    if (questionsError) {
      throw questionsError
    }

    const results = []

    // Test each question against each provider
    for (const question of questions) {
      const tested_llms = []
      const test_month = new Date().toISOString().split('T')[0] // YYYY-MM-DD format

      // Initialize result object with all LLM fields
      const result = {
        auth_user_id,
        question_id: question.id,
        question_text: question.question,
        expected_answer: question.ai_response_answers || '',
        test_schedule,
        test_month,
        tested_llms: [],
        // Initialize all LLM fields
        openai_response: null,
        gemini_response: null,
        perplexity_response: null,
        claude_response: null,
        openai_accuracy_score: null,
        gemini_accuracy_score: null,
        perplexity_accuracy_score: null,
        claude_accuracy_score: null,
        openai_cost_usd: null,
        gemini_cost_usd: null,
        perplexity_cost_usd: null,
        claude_cost_usd: null,
        openai_token_usage: null,
        gemini_token_usage: null,
        perplexity_token_usage: null,
        claude_token_usage: null,
        openai_response_time_ms: null,
        gemini_response_time_ms: null,
        perplexity_response_time_ms: null,
        claude_response_time_ms: null,
        openai_status: 'pending',
        gemini_status: 'pending',
        perplexity_status: 'pending',
        claude_status: 'pending',
        openai_error_message: null,
        gemini_error_message: null,
        perplexity_error_message: null,
        claude_error_message: null
      }

      // Test each AI provider
      for (const providerKey of ai_providers) {
        const startTime = Date.now()
        let response = ''
        let tokenUsage = 0
        let cost = 0
        let status = 'success'
        let errorMessage = ''

        try {
          // Provider configurations
          const providers = {
            openai: {
              url: 'https://api.openai.com/v1/chat/completions',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
                'Content-Type': 'application/json'
              },
              body: {
                model: 'gpt-4',
                messages: [{ role: 'user', content: question.question }],
                max_tokens: 1000,
                temperature: 0.7
              },
              tokenCost: 0.03
            },
            perplexity: {
              url: 'https://api.perplexity.ai/chat/completions',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('PERPLEXITY_API_KEY')}`,
                'Content-Type': 'application/json'
              },
              body: {
                model: 'llama-3.1-sonar-small-128k-online',
                messages: [{ role: 'user', content: question.question }],
                max_tokens: 1000
              },
              tokenCost: 0.02
            },
            gemini: {
              url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
              headers: {
                'Content-Type': 'application/json'
              },
              body: {
                contents: [{
                  parts: [{ text: question.question }]
                }],
                generationConfig: {
                  maxOutputTokens: 1000,
                  temperature: 0.7
                }
              },
              tokenCost: 0.01
            },
            claude: {
              url: 'https://api.anthropic.com/v1/messages',
              headers: {
                'x-api-key': Deno.env.get('CLAUDE_API_KEY'),
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
              },
              body: {
                model: 'claude-3-sonnet-20240229',
                max_tokens: 1000,
                messages: [{ role: 'user', content: question.question }]
              },
              tokenCost: 0.015
            }
          }

          const provider = providers[providerKey]
          if (!provider) {
            throw new Error(`Unsupported provider: ${providerKey}`)
          }

          const apiResponse = await fetch(provider.url, {
            method: 'POST',
            headers: provider.headers,
            body: JSON.stringify(provider.body)
          })

          if (!apiResponse.ok) {
            throw new Error(`API request failed: ${apiResponse.status}`)
          }

          const apiData = await apiResponse.json()
          const endTime = Date.now()
          const responseTime = endTime - startTime

          // Extract response based on provider
          if (providerKey === 'openai' || providerKey === 'perplexity') {
            response = apiData.choices?.[0]?.message?.content || ''
            tokenUsage = apiData.usage?.total_tokens || 0
          } else if (providerKey === 'gemini') {
            response = apiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
            tokenUsage = apiData.usageMetadata?.totalTokenCount || 0
          } else if (providerKey === 'claude') {
            response = apiData.content?.[0]?.text || ''
            tokenUsage = apiData.usage?.input_tokens + apiData.usage?.output_tokens || 0
          }

          // Calculate cost
          cost = (tokenUsage / 1000) * provider.tokenCost

          // Calculate accuracy (simple similarity)
          const accuracy = calculateSimilarity(question.ai_response_answers || '', response)

          // Update result object with this provider's data
          result[`${providerKey}_response`] = response
          result[`${providerKey}_accuracy_score`] = accuracy
          result[`${providerKey}_cost_usd`] = cost
          result[`${providerKey}_token_usage`] = tokenUsage
          result[`${providerKey}_response_time_ms`] = responseTime
          result[`${providerKey}_status`] = status

          tested_llms.push(providerKey)

        } catch (error) {
          const endTime = Date.now()
          errorMessage = error.message
          status = 'error'

          // Update result object with error data
          result[`${providerKey}_status`] = status
          result[`${providerKey}_error_message`] = errorMessage
          result[`${providerKey}_response_time_ms`] = endTime - startTime
        }
      }

      // Update tested_llms array
      result.tested_llms = tested_llms

      // Save result to database
      const { error: insertError } = await supabase
        .from('faq_performance_logs')
        .insert(result)

      if (insertError) {
        console.error('Failed to save result:', insertError)
      }

      results.push(result)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        summary: {
          total_tests: results.length,
          successful_tests: results.filter(r => r.tested_llms.length > 0).length,
          total_cost: results.reduce((sum, r) => {
            return sum + (r.openai_cost_usd || 0) + (r.gemini_cost_usd || 0) + 
                   (r.perplexity_cost_usd || 0) + (r.claude_cost_usd || 0)
          }, 0),
          total_tokens: results.reduce((sum, r) => {
            return sum + (r.openai_token_usage || 0) + (r.gemini_token_usage || 0) + 
                   (r.perplexity_token_usage || 0) + (r.claude_token_usage || 0)
          }, 0)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function calculateSimilarity(expected: string, actual: string): number {
  if (!expected || !actual) return 0
  
  const expectedWords = expected.toLowerCase().split(/\s+/)
  const actualWords = actual.toLowerCase().split(/\s+/)
  
  const commonWords = expectedWords.filter(word => actualWords.includes(word))
  const similarity = (commonWords.length / Math.max(expectedWords.length, actualWords.length)) * 100
  
  return Math.min(100, Math.max(0, similarity))
} 