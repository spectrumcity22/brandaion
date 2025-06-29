import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { auth_user_id, brand_id } = await request.json();

    if (!auth_user_id || !brand_id) {
      return NextResponse.json(
        { error: 'Both auth_user_id and brand_id are required' },
        { status: 400 }
      );
    }

    // Call the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('enrich_brand_jsonld', {
      body: { auth_user_id, brand_id }
    });

    if (error) {
      console.error('Error calling enrich_brand_jsonld function:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in enrich-brand-jsonld API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 