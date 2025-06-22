import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI GPT-4',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    tokenCost: 0.03,
    maxTokens: 4000
  },
  perplexity: {
    name: 'Perplexity AI',
    endpoint: 'https://api.perplexity.ai/chat/completions',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('PERPLEXITY_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    tokenCost: 0.02,
    maxTokens: 4000
  },
  gemini: {
    name: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    headers: {
      'Content-Type': 'application/json'
    },
    tokenCost: 0.015,
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
    tokenCost: 0.025,
    maxTokens: 4000
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { auth_user_id, question_ids, ai_providers, test_schedule = 'manual' } = await req.json();

    if (!auth_user_id || !question_ids || !ai_providers) {
      return new Response(JSON.stringify({
        error: 'Missing required parameters'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Use service role key to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch questions from database
    const { data: questions, error: questionsError } = await supabase
      .from('review_questions')
      .select('id, question, ai_response_answers, organisation_jsonld_object')
      .in('id', question_ids)
      .eq('auth_user_id', auth_user_id)
      .eq('question_status', 'question_approved');

    if (questionsError) {
      throw new Error(`Failed to fetch questions: ${questionsError.message}`);
    }

    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({
        error: 'No completed questions found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const results = [];

    // Test each question against each selected AI provider
    for (const question of questions) {
      const tested_llms = [];
      const test_month = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      // Initialize result object with all LLM fields for new table structure
      const result = {
        auth_user_id,
        question_id: question.id,
        question_text: question.question,
        expected_answer: question.ai_response_answers || '',
        test_schedule,
        test_month,
        tested_llms: [],
        // Add the required ai_provider field (use the first provider as default)
        ai_provider: ai_providers[0] || 'openai',
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
      };

      // Test each AI provider
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
          cost = tokenUsage / 1000 * provider.tokenCost;

          // Calculate accuracy (simple similarity)
          const accuracy = calculateSimilarity(question.ai_response_answers || '', response);

          // Update result object with this provider's data
          result[`${providerKey}_response`] = response;
          result[`${providerKey}_accuracy_score`] = accuracy;
          result[`${providerKey}_cost_usd`] = cost;
          result[`${providerKey}_token_usage`] = tokenUsage;
          result[`${providerKey}_response_time_ms`] = responseTime;
          result[`${providerKey}_status`] = status;

          tested_llms.push(providerKey);

        } catch (error) {
          const endTime = Date.now();
          errorMessage = error.message;
          status = 'error';

          // Update result object with error data
          result[`${providerKey}_status`] = status;
          result[`${providerKey}_error_message`] = errorMessage;
          result[`${providerKey}_response_time_ms`] = endTime - startTime;
        }
      }

      // Update tested_llms array
      result.tested_llms = tested_llms;

      // Save result to database with new structure
      console.log('Attempting to insert data:', JSON.stringify(result, null, 2));
      
      try {
        const { data: insertResult, error: insertError } = await supabase
          .from('faq_performance_logs')
          .insert(result)
          .select();

        if (insertError) {
          console.error('Failed to save result:', insertError);
          console.error('Insert data was:', JSON.stringify(result, null, 2));
          console.error('Error details:', {
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code
          });
        } else {
          console.log('Successfully saved result:', insertResult);
          console.log('Inserted record ID:', insertResult?.[0]?.id);
        }
      } catch (insertException) {
        console.error('Exception during insert:', insertException);
        console.error('Exception details:', {
          name: insertException.name,
          message: insertException.message,
          stack: insertException.stack
        });
      }

      results.push(result);
    }

    return new Response(JSON.stringify({
      success: true,
      results,
      summary: {
        total_tests: results.length,
        successful_tests: results.filter(r => r.tested_llms.length > 0).length,
        total_cost: results.reduce((sum, r) => {
          return sum + (r.openai_cost_usd || 0) + (r.gemini_cost_usd || 0) + 
                 (r.perplexity_cost_usd || 0) + (r.claude_cost_usd || 0);
        }, 0),
        total_tokens: results.reduce((sum, r) => {
          return sum + (r.openai_token_usage || 0) + (r.gemini_token_usage || 0) + 
                 (r.perplexity_token_usage || 0) + (r.claude_token_usage || 0);
        }, 0)
      }
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const words1 = str1.toLowerCase().split(/\s+/);
  const words2 = str2.toLowerCase().split(/\s+/);
  
  const commonWords = words1.filter(word => words2.includes(word));
  const similarity = (commonWords.length / Math.max(words1.length, words2.length)) * 100;
  
  return Math.min(100, Math.max(0, similarity));
} 