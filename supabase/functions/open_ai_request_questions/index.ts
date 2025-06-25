import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openaiApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const ASSISTANT_ID = 'asst_Pg4LSwxWsdCryjZ3G5a4S5KF';
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { batchId } = await req.json().catch(()=>({}));
    let query = supabase.from('construct_faq_pairs').select('*').eq('question_status', 'pending') // CHANGED: Use question_status instead of generation_status
    .is('ai_response_questions', null);
    if (batchId) {
      query = query.eq('unique_batch_id', batchId);
    }
    const { data: pendingPairs, error: fetchError } = await query;
    if (fetchError) {
      throw new Error(`Error fetching pairs: ${fetchError.message}`);
    }
    if (!pendingPairs?.length) {
      return new Response('No pending pairs found', {
        headers: corsHeaders,
        status: 200
      });
    }
    for (const pair of pendingPairs){
      try {
        if (!pair.ai_request_for_questions) {
          await supabase.from('construct_faq_pairs').update({
            question_status: 'pending',
            error_message: 'Missing ai_request_for_questions field'
          }).eq('id', pair.id);
          continue;
        }
        // Create thread
        const threadResponse = await fetch('https://api.openai.com/v1/threads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });
        if (!threadResponse.ok) {
          throw new Error('Failed to create thread');
        }
        const threadId = (await threadResponse.json()).id;
        // Send message
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
          throw new Error('Failed to send message');
        }
        // Start run
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
          throw new Error('Failed to start run');
        }
        const runId = (await runResponse.json()).id;
        let completed = false;
        let generatedQuestions = '';
        let attempts = 0;
        const MAX_ATTEMPTS = 30;
        const POLL_INTERVAL = 2000;
        while(!completed && attempts < MAX_ATTEMPTS){
          attempts++;
          const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'OpenAI-Beta': 'assistants=v2'
            }
          });
          if (!statusResponse.ok) {
            throw new Error('Failed to check run status');
          }
          const statusData = await statusResponse.json();
          if (statusData.status === 'completed') {
            const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'OpenAI-Beta': 'assistants=v2'
              }
            });
            if (!messagesResponse.ok) {
              throw new Error('Failed to fetch messages');
            }
            const messagesData = await messagesResponse.json();
            console.log('RAW OPENAI RESPONSE:', JSON.stringify(messagesData, null, 2));
            if (!messagesData.data?.[0]?.content?.[0]?.text?.value) {
              throw new Error('No valid response from assistant');
            }
            generatedQuestions = messagesData.data[0].content[0].text.value;
            console.log('EXACT TEXT FROM OPENAI:', generatedQuestions);
            completed = true;
          } else if (statusData.status === 'failed') {
            throw new Error(`Run failed: ${statusData.last_error?.message || 'Unknown error'}`);
          } else {
            await new Promise((resolve)=>setTimeout(resolve, POLL_INTERVAL));
          }
        }
        if (!completed) {
          throw new Error('Run did not complete within timeout');
        }
        if (!generatedQuestions) {
          throw new Error('Generated questions is empty or null');
        }
        // Store the raw text response
        const { error: updateError } = await supabase.from('construct_faq_pairs').update({
          ai_response_questions: generatedQuestions,
          question_status: 'questions_generated' // CHANGED: Use questions_generated instead of questions
        }).eq('id', pair.id);
        if (updateError) {
          throw new Error(`Failed to update database: ${updateError.message}`);
        }
      } catch (error) {
        console.error(`Error processing pair ${pair.id}:`, error);
        await supabase.from('construct_faq_pairs').update({
          error_message: error instanceof Error ? error.message : 'Unknown error',
          question_status: 'pending' // CHANGED: Reset to pending on error
        }).eq('id', pair.id);
      }
    }
    return new Response('success', {
      headers: corsHeaders,
      status: 200
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Unknown error', {
      headers: corsHeaders,
      status: 500
    });
  }
});
