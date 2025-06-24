import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Generate platform index content
    const { data: platformIndex, error } = await supabase.rpc('generate_platform_index');
    
    if (error) {
      console.error('Error generating platform index:', error);
      return NextResponse.json({ error: 'Failed to generate platform index' }, { status: 500 });
    }
    
    // Store or update the platform index in llm_discovery_files
    const { error: upsertError } = await supabase
      .from('llm_discovery_files')
      .upsert({
        file_path: '/data/platform-llms.txt',
        file_type: 'platform-index',
        entity_type: 'platform',
        entity_id: null,
        entity_slug: null,
        content_type: 'markdown',
        content: platformIndex,
        jsonld_data: null,
        last_generated: new Date().toISOString()
      }, {
        onConflict: 'file_path'
      });
    
    if (upsertError) {
      console.error('Error storing platform index:', upsertError);
    }
    
    // Return the content as markdown
    return new NextResponse(platformIndex, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
    
  } catch (error) {
    console.error('Error in platform index generation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Force regenerate platform index
    const { data: platformIndex, error } = await supabase.rpc('generate_platform_index');
    
    if (error) {
      console.error('Error regenerating platform index:', error);
      return NextResponse.json({ error: 'Failed to regenerate platform index' }, { status: 500 });
    }
    
    // Update the platform index in llm_discovery_files
    const { error: upsertError } = await supabase
      .from('llm_discovery_files')
      .upsert({
        file_path: '/data/platform-llms.txt',
        file_type: 'platform-index',
        entity_type: 'platform',
        entity_id: null,
        entity_slug: null,
        content_type: 'markdown',
        content: platformIndex,
        jsonld_data: null,
        last_generated: new Date().toISOString()
      }, {
        onConflict: 'file_path'
      });
    
    if (upsertError) {
      console.error('Error updating platform index:', upsertError);
      return NextResponse.json({ error: 'Failed to update platform index' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Platform index regenerated successfully',
      last_generated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in platform index regeneration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 