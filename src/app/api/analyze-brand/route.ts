import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const { brand_id, brand_url, brand_name } = await request.json();

    if (!brand_id || !brand_url || !brand_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Call the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('analyze-brand', {
      body: {
        brand_id,
        brand_url,
        brand_name
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 