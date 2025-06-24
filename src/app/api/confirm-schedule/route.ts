import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const { schedule_id } = await request.json();

    if (!schedule_id) {
      return NextResponse.json(
        { error: 'schedule_id is required' },
        { status: 400 }
      );
    }

    // Call the manual function to create construct_faq_pairs records
    const { error } = await supabase.rpc('create_construct_faq_pairs_from_schedule', {
      schedule_id: schedule_id
    });

    if (error) {
      console.error('Error creating construct_faq_pairs:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Schedule confirmed and construct_faq_pairs created successfully'
    });

  } catch (error) {
    console.error('Error in confirm-schedule API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 