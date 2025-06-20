import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openaiApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const ASSISTANT_ID = 'asst_dM4zy0de2i9RGbLPVCFLcxBy';

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
    const { question_id, auth_user_id } = await req.json().catch(()=>({}));
    console.log('Received request with question_id:', question_id);
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables are not set');
    }
    let query = supabase.from('review_questions').select('*').eq('question_status', 'question_approved').is('ai_response_answers', null);
    if (question_id) {
      query = query.eq('id', question_id);
    }
    const { data: approvedQuestions, error: fetchError } = await query;
    if (fetchError) {
      throw new Error(`Error fetching approved questions: ${fetchError.message}`);
    }
    console.log('Found approved questions:', approvedQuestions?.length || 0);
    if (!approvedQuestions?.length) {
      return new Response('No approved questions found for answer generation', {
        headers: corsHeaders,
        status: 200
      });
    }
    for (const question of approvedQuestions){
      try {
        console.log(`Processing question ID: ${question.id}`);
        if (!question.ai_request_for_answers) {
          console.log(`Question ${question.id} missing ai_request_for_answers field`);
          await supabase.from('review_questions').update({
            answer_status: 'failed',
            error_message: 'Missing ai_request_for_answers field'
          }).eq('id', question.id);
          continue;
        }
        console.log(`Creating thread for question ${question.id}`);
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
          throw new Error(`Failed to create thread: ${threadResponse.status} ${threadResponse.statusText} - ${errorText}`);
        }
        const threadId = (await threadResponse.json()).id;
        console.log(`Created thread ID: ${threadId}`);
        console.log(`Sending message to agent for question ${question.id}`);
        const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          },
          body: JSON.stringify({
            role: 'user',
            content: question.ai_request_for_answers
          })
        });
        if (!messageResponse.ok) {
          const errorText = await messageResponse.text();
          throw new Error(`Failed to send message: ${messageResponse.status} ${messageResponse.statusText} - ${errorText}`);
        }
        console.log(`Starting run with agent ID: ${ASSISTANT_ID}`);
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
          throw new Error(`Failed to start run: ${runResponse.status} ${runResponse.statusText} - ${errorText}`);
        }
        const runId = (await runResponse.json()).id;
        console.log(`Started run ID: ${runId}`);
        let completed = false;
        let generatedAnswer = '';
        let attempts = 0;
        const MAX_ATTEMPTS = 30;
        const POLL_INTERVAL = 2000;
        const startTime = Date.now();
        const MAX_DURATION = 300000;
        while(!completed && attempts < MAX_ATTEMPTS){
          attempts++;
          if (Date.now() - startTime > MAX_DURATION) {
            throw new Error('Function timeout exceeded (5 minutes)');
          }
          console.log(`Polling attempt ${attempts}/${MAX_ATTEMPTS} for question ${question.id}`);
          const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'OpenAI-Beta': 'assistants=v2'
            }
          });
          if (!statusResponse.ok) {
            const errorText = await statusResponse.text();
            throw new Error(`Failed to check run status: ${statusResponse.status} ${statusResponse.statusText} - ${errorText}`);
          }
          const statusData = await statusResponse.json();
          console.log(`Run status for question ${question.id}: ${statusData.status}`);
          if (statusData.status === 'completed') {
            console.log(`Run completed for question ${question.id}, fetching messages`);
            const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'OpenAI-Beta': 'assistants=v2'
              }
            });
            if (!messagesResponse.ok) {
              const errorText = await messagesResponse.text();
              throw new Error(`Failed to fetch messages: ${messagesResponse.status} ${messagesResponse.statusText} - ${errorText}`);
            }
            const messagesData = await messagesResponse.json();
            console.log('RAW OPENAI RESPONSE:', JSON.stringify(messagesData, null, 2));
            if (!messagesData.data?.[0]?.content?.[0]?.text?.value) {
              throw new Error('No valid response from assistant');
            }
            generatedAnswer = messagesData.data[0].content[0].text.value;
            console.log(`Generated answer for question ${question.id}, length: ${generatedAnswer.length}`);
            console.log('EXACT TEXT FROM OPENAI:', generatedAnswer);
            completed = true;
          } else if (statusData.status === 'failed') {
            throw new Error(`Run failed: ${statusData.last_error?.message || 'Unknown error'}`);
          } else {
            await new Promise((resolve)=>setTimeout(resolve, POLL_INTERVAL));
          }
        }
        if (!completed) {
          throw new Error(`Run did not complete within ${MAX_ATTEMPTS} attempts`);
        }
        if (!generatedAnswer) {
          throw new Error('Generated answer is empty or null');
        }
        console.log(`Storing answer in database for question ${question.id}`);
        const { error: updateError } = await supabase.from('review_questions').update({
          ai_response_answers: generatedAnswer,
          answer_status: 'completed'
        }).eq('id', question.id);
        if (updateError) {
          throw new Error(`Failed to update database: ${updateError.message}`);
        }
        console.log(`Successfully processed question ${question.id}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing question ${question.id}:`, errorMessage);
        await supabase.from('review_questions').update({
          error_message: `Processing failed: ${errorMessage}`,
          answer_status: 'failed'
        }).eq('id', question.id);
      }
    }
    return new Response(JSON.stringify({ message: 'success' }), {
      headers: corsHeaders,
      status: 200
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Top-level error:', errorMessage);
    return new Response(errorMessage, {
      headers: corsHeaders,
      status: 500
    });
  }
}); 