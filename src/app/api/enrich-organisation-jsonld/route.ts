import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { auth_user_id, client_organisation_id } = await request.json();

    if (!auth_user_id && !client_organisation_id) {
      return NextResponse.json({ 
        error: 'Either auth_user_id or client_organisation_id is required' 
      }, { status: 400 });
    }

    console.log('Calling edge function with:', { auth_user_id, client_organisation_id });

    // Call the Supabase edge function
    const response = await fetch(`${supabaseUrl}/functions/v1/enrich_organisation_jsonld`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify({ auth_user_id, client_organisation_id })
    });

    console.log('Edge function response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Edge function error response:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      
      return NextResponse.json({ 
        error: errorData.error || `HTTP ${response.status}: ${errorText}` 
      }, { status: response.status });
    }

    const result = await response.json();
    console.log('Edge function success result:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error calling enrich_organisation_jsonld function:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 