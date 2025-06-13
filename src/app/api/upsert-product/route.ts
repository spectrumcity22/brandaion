import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log('API received payload:', JSON.stringify(payload, null, 2));

    // Validate required fields
    const requiredFields = ['auth_user_id', 'product_name'];
    const missingFields = requiredFields.filter(field => !payload[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return NextResponse.json({ 
        error: `Missing required fields: ${missingFields.join(', ')}`,
        receivedPayload: payload 
      }, { status: 400 });
    }

    // Clean up the payload
    const cleanPayload = {
      auth_user_id: payload.auth_user_id,
      product_name: payload.product_name,
      description: payload.description || null,
      keywords: payload.keywords || null,
      url: payload.url || null,
      category: payload.category || null,
      user_email: payload.user_email || null,
      organisation: payload.organisation || null,
      market: payload.market || null,
      schema_json: payload.schema_json || null
    };

    console.log('Clean payload for Supabase:', JSON.stringify(cleanPayload, null, 2));

    const { data, error } = await supabase
      .from('products')
      .upsert(cleanPayload, { 
        onConflict: 'auth_user_id,product_name'
      });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ 
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Internal error:', err);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
} 