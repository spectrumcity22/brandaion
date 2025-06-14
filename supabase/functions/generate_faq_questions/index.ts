import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openaiApiKey = Deno.env.get('OPENAI_API_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get pending FAQ pairs directly using service role key
    const { data: pendingPairs, error: fetchError } = await supabase
      .from('construct_faq_pairs')
      .select('*')
      .eq('generation_status', 'pending')
      .is('ai_response_questions', null);

    if (fetchError) {
      throw new Error(`Error fetching pending FAQ pairs: ${fetchError.message}`);
    }

    if (!pendingPairs || pendingPairs.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No pending FAQ pairs found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Process each pending pair
    for (const pair of pendingPairs) {
      try {
        // Create a thread
        const threadResponse = await fetch('https://api.openai.com/v1/threads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
            'OpenAI-Beta': 'assistants=v1'
          }
        });

        if (!threadResponse.ok) {
          throw new Error(`Error creating thread: ${threadResponse.statusText}`);
        }

        const threadData = await threadResponse.json();
        const threadId = threadData.id;

        // Add message to thread
        const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
            'OpenAI-Beta': 'assistants=v1'
          },
          body: JSON.stringify({
            role: 'user',
            content: pair.ai_request_for_questions
          })
        });

        if (!messageResponse.ok) {
          throw new Error(`Error adding message: ${messageResponse.statusText}`);
        }

        // Run the assistant
        const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
            'OpenAI-Beta': 'assistants=v1'
          },
          body: JSON.stringify({
            assistant_id: 'asst_zOfUjZ4PLSPtkp7HcE2qPegi'
          })
        });

        if (!runResponse.ok) {
          throw new Error(`Error starting run: ${runResponse.statusText}`);
        }

        const runData = await runResponse.json();
        const runId = runData.id;

        // Poll for completion
        let completed = false;
        let generatedQuestions = '';
        
        while (!completed) {
          const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'OpenAI-Beta': 'assistants=v1'
            }
          });

          if (!statusResponse.ok) {
            throw new Error(`Error checking run status: ${statusResponse.statusText}`);
          }

          const statusData = await statusResponse.json();
          
          if (statusData.status === 'completed') {
            completed = true;
            
            // Get the messages
            const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'OpenAI-Beta': 'assistants=v1'
              }
            });

            if (!messagesResponse.ok) {
              throw new Error(`Error getting messages: ${messagesResponse.statusText}`);
            }

            const messagesData = await messagesResponse.json();
            generatedQuestions = messagesData.data[0].content[0].text.value;
          } else if (statusData.status === 'failed') {
            throw new Error(`Run failed: ${statusData.last_error?.message || 'Unknown error'}`);
          } else {
            // Wait before polling again
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        // Update the FAQ pair with the generated questions
        const { error: updateError } = await supabase
          .from('construct_faq_pairs')
          .update({
            ai_response_questions: generatedQuestions,
            generation_status: 'completed'
          })
          .eq('id', pair.id);

        if (updateError) {
          throw new Error(`Error updating FAQ pair: ${updateError.message}`);
        }
      } catch (error) {
        // If there's an error processing a pair, update its status to error
        await supabase
          .from('construct_faq_pairs')
          .update({
            generation_status: 'error',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', pair.id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'FAQ questions generation completed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('Error in generate_faq_questions function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
}); 