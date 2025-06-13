import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import OpenAI from 'https://esm.sh/openai@4.0.0';

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
    // Parse the request body
    const { id } = await req.json();
    if (!id) {
      throw new Error('id is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Update status to generating questions
    await supabase
      .from('construct_faq_pairs')
      .update({ generation_status: 'generating_questions' })
      .eq('id', id);

    // Get the FAQ pair record
    const { data: faqPair, error: faqError } = await supabase
      .from('construct_faq_pairs')
      .select('*')
      .eq('id', id)
      .single();

    if (faqError || !faqPair) {
      throw new Error(`FAQ pair not found: ${faqError?.message}`);
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    });

    // Prepare the prompt for OpenAI
    const prompt = `Based on the following context, generate ${faqPair.batch_faq_pairs} relevant FAQ questions (between 5 and 20 questions). 
    Format each question on a new line with a number (e.g., "1. Question here").
    
    Context:
    ${faqPair.ai_request_for_questions}`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that generates FAQ questions based on the provided context. Generate questions that are relevant to the brand, product, and audience context provided. Format each question on a new line with a number."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const generatedQuestions = completion.choices[0].message.content;

    // Update the FAQ pair with the generated questions and status
    await supabase
      .from('construct_faq_pairs')
      .update({ 
        ai_response_questions: generatedQuestions,
        generation_status: 'questions_generated'
      })
      .eq('id', id);

    // Split questions into individual rows in client_faq_pairs
    const questions = generatedQuestions.split('\n').filter(q => q.trim());
    const faqPairs = questions.map(question => ({
      construct_faq_pair_id: id,
      question: question.replace(/^\d+\.\s*/, '').trim(),
      status: 'pending'
    }));

    // Insert the FAQ pairs
    const { error: insertError } = await supabase
      .from('client_faq_pairs')
      .insert(faqPairs);

    if (insertError) {
      throw new Error(`Failed to insert FAQ pairs: ${insertError.message}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Questions generated and stored successfully',
      questions: generatedQuestions,
      faqPairId: id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('Error in generate_questions function:', error);
    
    // Update the FAQ pair with error status
    if (id) {
      await supabase
        .from('construct_faq_pairs')
        .update({ 
          generation_status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', id);
    }

    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
}); 