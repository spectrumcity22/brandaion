import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AIProviderConfig {
  name: string;
  endpoint: string;
  headers: Record<string, string>;
  tokenCost: number;
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
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const today = new Date().toISOString().split('T')[0];
    console.log(`Starting monthly FAQ tests for date: ${today}`);

    // Step 1: Get users who need testing today
    const { data: usersToTest, error: usersError } = await supabase
      .from('user_monthly_schedule')
      .select(`
        user_id,
        next_test_date,
        package_tier,
        subscription_status
      `)
      .eq('next_test_date', today)
      .eq('subscription_status', 'active');

    if (usersError) {
      throw new Error(`Failed to fetch users for testing: ${usersError.message}`);
    }

    if (!usersToTest || usersToTest.length === 0) {
      console.log('No users need testing today');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No users need testing today',
          tested_users: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${usersToTest.length} users to test`);

    const results = [];

    // Step 2: Process each user
    for (const userSchedule of usersToTest) {
      try {
        console.log(`Processing user: ${userSchedule.user_id}`);

        // Check subscription status
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .rpc('check_user_subscription_status', { user_id_param: userSchedule.user_id });

        if (subscriptionError) {
          console.error(`Subscription check failed for user ${userSchedule.user_id}:`, subscriptionError);
          continue;
        }

        if (!subscriptionData || subscriptionData.length === 0 || !subscriptionData[0].has_active_subscription) {
          console.log(`User ${userSchedule.user_id} has no active subscription, skipping`);
          continue;
        }

        // Step 3: Get user's selected questions
        const { data: selectedQuestions, error: questionsError } = await supabase
          .from('user_monthly_questions')
          .select(`
            question_id,
            package_tier
          `)
          .eq('user_id', userSchedule.user_id)
          .eq('is_active', true);

        if (questionsError) {
          console.error(`Failed to fetch questions for user ${userSchedule.user_id}:`, questionsError);
          continue;
        }

        if (!selectedQuestions || selectedQuestions.length === 0) {
          console.log(`User ${userSchedule.user_id} has no selected questions, skipping`);
          continue;
        }

        // Step 4: Get user's selected LLMs
        const { data: selectedLLMs, error: llmsError } = await supabase
          .from('user_monthly_llms')
          .select('llm_provider')
          .eq('user_id', userSchedule.user_id)
          .eq('is_active', true);

        if (llmsError) {
          console.error(`Failed to fetch LLMs for user ${userSchedule.user_id}:`, llmsError);
          continue;
        }

        if (!selectedLLMs || selectedLLMs.length === 0) {
          console.log(`User ${userSchedule.user_id} has no selected LLMs, skipping`);
          continue;
        }

        // Step 5: Get question details
        const questionIds = selectedQuestions.map(q => q.question_id);
        const { data: questions, error: questionDetailsError } = await supabase
          .from('review_questions')
          .select('id, question, ai_response_answers, organisation_jsonld_object')
          .in('id', questionIds)
          .eq('question_status', 'question_approved');

        if (questionDetailsError) {
          console.error(`Failed to fetch question details for user ${userSchedule.user_id}:`, questionDetailsError);
          continue;
        }

        if (!questions || questions.length === 0) {
          console.log(`User ${userSchedule.user_id} has no approved questions, skipping`);
          continue;
        }

        // Step 6: Run tests for each question and LLM
        const llmProviders = selectedLLMs.map(llm => llm.llm_provider);
        let testsRun = 0;

        for (const question of questions) {
          for (const providerKey of llmProviders) {
            const provider = AI_PROVIDERS[providerKey];
            if (!provider) {
              console.warn(`Unknown provider: ${providerKey}`);
              continue;
            }

            try {
              const startTime = Date.now();
              
              // Prepare the prompt
              const prompt = `Please answer the following question based on the provided context. Provide a clear, accurate, and helpful response.

Question: ${question.question}

Expected Answer Context: ${question.ai_response_answers}

Please provide your answer:`;

              // Make API call
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
              let response = '';
              let tokenUsage = 0;
              
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
              const cost = (tokenUsage / 1000) * provider.tokenCost;

              // Calculate accuracy (simple similarity)
              const accuracy = calculateSimilarity(question.ai_response_answers || '', response);

              // Save result to database
              const { error: insertError } = await supabase
                .from('faq_performance_logs')
                .insert({
                  auth_user_id: userSchedule.user_id,
                  question_id: question.id,
                  question_text: question.question,
                  expected_answer: question.ai_response_answers || '',
                  ai_response: response,
                  response_time_ms: responseTime,
                  accuracy_score: accuracy,
                  token_usage: tokenUsage,
                  cost_usd: cost,
                  status: 'success',
                  ai_provider: providerKey,
                  test_schedule: 'monthly'
                });

              if (insertError) {
                console.error('Failed to save result:', insertError);
              } else {
                testsRun++;
              }

            } catch (error) {
              console.error(`Test failed for question ${question.id} with provider ${providerKey}:`, error);
              
              // Save error result
              await supabase
                .from('faq_performance_logs')
                .insert({
                  auth_user_id: userSchedule.user_id,
                  question_id: question.id,
                  question_text: question.question,
                  expected_answer: question.ai_response_answers || '',
                  ai_response: '',
                  response_time_ms: 0,
                  accuracy_score: 0,
                  token_usage: 0,
                  cost_usd: 0,
                  status: 'error',
                  ai_provider: providerKey,
                  test_schedule: 'monthly',
                  error_message: error.message
                });
            }
          }
        }

        // Step 7: Update next test date (monthly = next month)
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const nextTestDate = nextMonth.toISOString().split('T')[0];

        await supabase
          .from('user_monthly_schedule')
          .update({ 
            next_test_date: nextTestDate,
            last_test_month: today,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userSchedule.user_id);

        results.push({
          user_id: userSchedule.user_id,
          tests_run: testsRun,
          questions_tested: questions.length,
          llms_tested: llmProviders.length,
          next_test_date: nextTestDate
        });

        console.log(`Completed testing for user ${userSchedule.user_id}: ${testsRun} tests run`);

      } catch (error) {
        console.error(`Error processing user ${userSchedule.user_id}:`, error);
        results.push({
          user_id: userSchedule.user_id,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Monthly FAQ tests completed for ${usersToTest.length} users`,
        results,
        total_tested_users: usersToTest.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in monthly FAQ tests:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function calculateSimilarity(str1: string, str2: string): number {
  // Simple similarity calculation - can be improved
  const words1 = str1.toLowerCase().split(/\s+/);
  const words2 = str2.toLowerCase().split(/\s+/);
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalWords = Math.max(words1.length, words2.length);
  
  return totalWords > 0 ? commonWords.length / totalWords : 0;
} 