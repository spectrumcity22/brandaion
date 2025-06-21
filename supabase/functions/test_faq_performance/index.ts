import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestRequest {
  auth_user_id: string;
  question_ids: string[];
  ai_providers: string[];
  test_schedule?: 'manual' | 'weekly' | 'monthly';
}

interface AIProviderConfig {
  name: string;
  endpoint: string;
  headers: Record<string, string>;
  tokenCost: number; // Cost per 1K tokens
  maxTokens: number;
}

const AI_PROVIDERS: Record<string, AIProviderConfig> = {
  openai: {
    name: 'OpenAI GPT-4',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    tokenCost: 0.03, // $0.03 per 1K tokens
    maxTokens: 4000
  },
  perplexity: {
    name: 'Perplexity AI',
    endpoint: 'https://api.perplexity.ai/chat/completions',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('PERPLEXITY_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    tokenCost: 0.02, // $0.02 per 1K tokens
    maxTokens: 4000
  },
  gemini: {
    name: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    headers: {
      'Content-Type': 'application/json'
    },
    tokenCost: 0.015, // $0.015 per 1K tokens
    maxTokens: 8000
  },
  claude: {
    name: 'Anthropic Claude',
    endpoint: 'https://api.anthropic.com/v1/messages',
    headers: {
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') || '',
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    tokenCost: 0.025, // $0.025 per 1K tokens
    maxTokens: 4000
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { auth_user_id, question_ids, ai_providers, test_schedule = 'manual' } = await req.json() as TestRequest;

    if (!auth_user_id || !question_ids || !ai_providers) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Fetch questions from database
    const { data: questions, error: questionsError } = await supabase
      .from('review_questions')
      .select('id, question, ai_response_answers, organisation_jsonld_object')
      .in('id', question_ids)
      .eq('auth_user_id', auth_user_id)
      .eq('answer_status', 'completed');

    if (questionsError) {
      throw new Error(`Failed to fetch questions: ${questionsError.message}`);
    }

    if (!questions || questions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No completed questions found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = [];

    // Test each question against each selected AI provider
    for (const question of questions) {
      for (const providerKey of ai_providers) {
        const provider = AI_PROVIDERS[providerKey];
        if (!provider) {
          console.warn(`Unknown provider: ${providerKey}`);
          continue;
        }

        const startTime = Date.now();
        let response = '';
        let tokenUsage = 0;
        let cost = 0;
        let status = 'success';
        let errorMessage = '';

        try {
          // Prepare the prompt
          const prompt = `Please answer the following question based on the provided context. Provide a clear, accurate, and helpful response.

Question: ${question.question}

Expected Answer Context: ${question.ai_response_answers}

Please provide your answer:`;

          // Make API call to the selected provider
          const apiResponse = await fetch(provider.endpoint, {
            method: 'POST',
            headers: provider.headers,
            body: JSON.stringify({
              model: providerKey === 'openai' ? 'gpt-4' : 
                     providerKey === 'perplexity' ? 'llama-3.1-sonar-large-128k-online' :
                     providerKey === 'gemini' ? 'gemini-pro' :
                     providerKey === 'claude' ? 'claude-3-sonnet-20240229' : 'gpt-4',
              messages: [
                {
                  role: 'user',
                  content: prompt
                }
              ],
              max_tokens: provider.maxTokens,
              temperature: 0.7
            })
          });

          const endTime = Date.now();
          const responseTime = endTime - startTime;

          if (!apiResponse.ok) {
            throw new Error(`API Error: ${apiResponse.status} ${apiResponse.statusText}`);
          }

          const apiData = await apiResponse.json();
          
          // Extract response based on provider
          if (providerKey === 'openai' || providerKey === 'perplexity') {
            response = apiData.choices?.[0]?.message?.content || '';
            tokenUsage = apiData.usage?.total_tokens || 0;
          } else if (providerKey === 'gemini') {
            response = apiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            tokenUsage = apiData.usageMetadata?.totalTokenCount || 0;
          } else if (providerKey === 'claude') {
            response = apiData.content?.[0]?.text || '';
            tokenUsage = apiData.usage?.input_tokens + apiData.usage?.output_tokens || 0;
          }

          // Calculate cost
          cost = (tokenUsage / 1000) * provider.tokenCost;

          // Calculate accuracy (simple similarity)
          const accuracy = calculateSimilarity(question.ai_response_answers || '', response);

          // Save result to database
          const { error: insertError } = await supabase
            .from('faq_performance_logs')
            .insert({
              auth_user_id,
              question_id: question.id,
              question_text: question.question,
              expected_answer: question.ai_response_answers || '',
              ai_response: response,
              response_time_ms: responseTime,
              accuracy_score: accuracy,
              token_usage: tokenUsage,
              cost_usd: cost,
              status,
              ai_provider: providerKey,
              test_schedule
            });

          if (insertError) {
            console.error('Failed to save result:', insertError);
          }

          results.push({
            question_id: question.id,
            provider: providerKey,
            response,
            response_time_ms: responseTime,
            accuracy_score: accuracy,
            token_usage: tokenUsage,
            cost_usd: cost,
            status
          });

        } catch (error) {
          const endTime = Date.now();
          errorMessage = error.message;
          status = 'error';

          // Save error result to database
          const { error: insertError } = await supabase
            .from('faq_performance_logs')
            .insert({
              auth_user_id,
              question_id: question.id,
              question_text: question.question,
              expected_answer: question.ai_response_answers || '',
              ai_response: '',
              response_time_ms: endTime - startTime,
              accuracy_score: 0,
              token_usage: 0,
              cost_usd: 0,
              status,
              error_message: errorMessage,
              ai_provider: providerKey,
              test_schedule
            });

          if (insertError) {
            console.error('Failed to save error result:', insertError);
          }

          results.push({
            question_id: question.id,
            provider: providerKey,
            response: '',
            response_time_ms: endTime - startTime,
            accuracy_score: 0,
            token_usage: 0,
            cost_usd: 0,
            status,
            error_message: errorMessage
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        summary: {
          total_tests: results.length,
          successful_tests: results.filter(r => r.status === 'success').length,
          total_cost: results.reduce((sum, r) => sum + (r.cost_usd || 0), 0),
          total_tokens: results.reduce((sum, r) => sum + (r.token_usage || 0), 0),
          average_accuracy: results.filter(r => r.status === 'success').reduce((sum, r) => sum + (r.accuracy_score || 0), 0) / Math.max(1, results.filter(r => r.status === 'success').length)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const words1 = str1.toLowerCase().split(/\s+/);
  const words2 = str2.toLowerCase().split(/\s+/);
  const commonWords = words1.filter(word => words2.includes(word));
  return Math.min(100, (commonWords.length / Math.max(words1.length, words2.length)) * 100);
} 