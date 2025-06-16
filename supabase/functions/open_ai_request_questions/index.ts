import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openaiApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const ASSISTANT_ID = 'asst_zOfUjZ4PLSPtkp7HcE2qPegi'; // Question Agent
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    console.log('Starting FAQ questions generation process');
    console.log('Using Assistant ID:', ASSISTANT_ID);

    // Get the batch ID from the request if provided
    const { batchId } = await req.json().catch(() => ({}));

    // Build the query
    let query = supabase
      .from('construct_faq_pairs')
      .select('*')
      .eq('generation_status', 'pending')
      .is('ai_response_questions', null);

    // If batchId is provided, filter by it
    if (batchId) {
      query = query.eq('unique_batch_id', batchId);
    }

    const { data: pendingPairs, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching pending pairs:', fetchError);
      throw new Error(`Error fetching pending FAQ pairs: ${fetchError.message}`);
    }

    if (!pendingPairs || pendingPairs.length === 0) {
      console.log('No pending FAQ pairs found');
      return new Response(
        JSON.stringify({
          message: 'No pending FAQ pairs found'
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        }
      );
    }

    console.log(`Found ${pendingPairs.length} pending pairs to process`);

    for (const pair of pendingPairs) {
      try {
        console.log(`\nProcessing pair ${pair.id}`);
        
        // Validate required fields
        if (!pair.ai_request_for_questions) {
          console.error(`Skipping pair ${pair.id} due to missing ai_request_for_questions`);
          await supabase
            .from('construct_faq_pairs')
            .update({ 
              generation_status: 'error',
              error_message: 'Missing ai_request_for_questions field'
            })
            .eq('id', pair.id);
          continue;
        }

        console.log('Request content:', pair.ai_request_for_questions);

        // Create a thread
        console.log('Creating OpenAI thread...');
        const threadResponse = await fetch('https://api.openai.com/v1/threads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });

        if (!threadResponse.ok) {
          const errorText = await threadResponse.text();
          console.error('Thread creation error:', errorText);
          throw new Error(`Error creating thread: ${errorText}`);
        }

        const threadData = await threadResponse.json();
        const threadId = threadData.id;
        console.log('Successfully created thread:', threadId);

        // Add message to thread
        console.log('Adding message to thread...');
        const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          },
          body: JSON.stringify({
            role: 'user',
            content: pair.ai_request_for_questions
          })
        });

        if (!messageResponse.ok) {
          const errorText = await messageResponse.text();
          console.error('Message creation error:', errorText);
          throw new Error(`Error adding message: ${errorText}`);
        }

        console.log('Successfully added message to thread');

        // Run the assistant
        console.log('Starting assistant run with ID:', ASSISTANT_ID);
        const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          },
          body: JSON.stringify({
            assistant_id: ASSISTANT_ID
          })
        });

        if (!runResponse.ok) {
          const errorText = await runResponse.text();
          console.error('Run creation error:', errorText);
          throw new Error(`Error starting run: ${errorText}`);
        }

        const runData = await runResponse.json();
        const runId = runData.id;
        console.log('Successfully started run:', runId);

        // Poll for completion
        let completed = false;
        let generatedQuestions = '';
        let pollCount = 0;
        const MAX_POLLS = 30;
        const POLL_INTERVAL = 2000; // 2 seconds

        console.log('Polling for run completion...');
        while (!completed && pollCount < MAX_POLLS) {
          pollCount++;
          console.log(`Poll attempt ${pollCount}/${MAX_POLLS}`);

          const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'OpenAI-Beta': 'assistants=v2'
            }
          });

          if (!statusResponse.ok) {
            const errorText = await statusResponse.text();
            console.error('Status check error:', errorText);
            throw new Error(`Error checking run status: ${errorText}`);
          }

          const statusData = await statusResponse.json();
          console.log(`Run status: ${statusData.status}`);

          if (statusData.status === 'completed') {
            completed = true;
            console.log('Run completed, fetching messages...');

            const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'OpenAI-Beta': 'assistants=v2'
              }
            });

            if (!messagesResponse.ok) {
              const errorText = await messagesResponse.text();
              console.error('Messages fetch error:', errorText);
              throw new Error(`Error getting messages: ${errorText}`);
            }

            const messagesData = await messagesResponse.json();
            console.log('Messages response:', JSON.stringify(messagesData, null, 2));

            if (messagesData.data && messagesData.data.length > 0) {
              generatedQuestions = messagesData.data[0].content[0].text.value;
              console.log('Generated questions:', generatedQuestions);
            } else {
              throw new Error('No messages found in the response');
            }
          } else if (statusData.status === 'failed') {
            console.error('Run failed:', statusData.last_error);
            throw new Error(`Run failed: ${statusData.last_error?.message || 'Unknown error'}`);
          } else {
            console.log(`Waiting ${POLL_INTERVAL}ms before next poll...`);
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
          }
        }

        if (!completed) {
          throw new Error(`Run did not complete within ${MAX_POLLS} attempts`);
        }

        // Update the FAQ pair with questions and status
        console.log('Updating FAQ pair in database...');
        const { error: updateError } = await supabase
          .from('construct_faq_pairs')
          .update({
            ai_response_questions: generatedQuestions.toString(),
            generation_status: 'questions_generated'
          })
          .eq('id', pair.id);

        if (updateError) {
          console.error('Database update error:', updateError);
          throw new Error(`Error updating FAQ pair: ${updateError.message}`);
        }

        console.log(`Successfully processed pair ${pair.id}`);
      } catch (error) {
        console.error(`Error processing pair ${pair.id}:`, error);
        // Update error message but keep status as pending
        await supabase
          .from('construct_faq_pairs')
          .update({
            error_message: error instanceof Error ? error.message : 'Unknown error',
            generation_status: 'pending'  // Keep as pending instead of failed
          })
          .eq('id', pair.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'FAQ questions generation completed'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in generate_faq_questions function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      }
    );
  }
}); 