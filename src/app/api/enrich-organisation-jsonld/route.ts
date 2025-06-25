import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { auth_user_id, client_organisation_id } = await request.json();

    if (!auth_user_id && !client_organisation_id) {
      return NextResponse.json({ 
        error: 'Either auth_user_id or client_organisation_id is required' 
      }, { status: 400 });
    }

    // Call the Supabase edge function
    const response = await fetch(`${supabaseUrl}/functions/v1/enrich_organisation_jsonld`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ auth_user_id, client_organisation_id })
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({ 
        error: result.error || 'Failed to enrich organization JSON-LD' 
      }, { status: response.status });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error calling enrich_organisation_jsonld function:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 