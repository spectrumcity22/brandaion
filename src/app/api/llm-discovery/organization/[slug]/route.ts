import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { slug } = await params;
    
    // Get the file type from the URL path
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const fileType = pathSegments[pathSegments.length - 1]; // e.g., 'organization-llms.txt' or 'organization.jsonld'
    
    // Get organization ID from slug
    const { data: orgSlug, error: slugError } = await supabase
      .from('organization_slugs')
      .select('organization_id')
      .eq('slug', slug)
      .single();
    
    if (slugError || !orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    
    const organizationId = orgSlug.organization_id;
    
    // Check if we have a cached version
    const { data: cachedFile } = await supabase
      .from('llm_discovery_files')
      .select('*')
      .eq('entity_type', 'organization')
      .eq('entity_id', organizationId)
      .eq('file_type', fileType === 'organization-llms.txt' ? 'organization-index' : 'organization-jsonld')
      .single();
    
    // If we have a recent cached version (less than 1 hour old), return it
    if (cachedFile && cachedFile.last_generated) {
      const lastGenerated = new Date(cachedFile.last_generated);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      if (lastGenerated > oneHourAgo) {
        const contentType = fileType.endsWith('.jsonld') ? 'application/ld+json' : 'text/markdown';
        return new NextResponse(cachedFile.content, {
          status: 200,
          headers: {
            'Content-Type': `${contentType}; charset=utf-8`,
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    }
    
    // Generate fresh content
    let content: string;
    let contentType: string;
    let fileTypeForDb: string;
    let jsonldData: any = null;
    
    if (fileType === 'organization-llms.txt') {
      // Generate organization index
      const { data: indexContent, error: indexError } = await supabase.rpc('generate_organization_index', { org_id: organizationId });
      
      if (indexError) {
        console.error('Error generating organization index:', indexError);
        return NextResponse.json({ error: 'Failed to generate organization index' }, { status: 500 });
      }
      
      content = indexContent;
      contentType = 'text/markdown';
      fileTypeForDb = 'organization-index';
    } else if (fileType === 'organization.jsonld') {
      // Generate organization JSON-LD
      const { data: jsonldResult, error: jsonldError } = await supabase.rpc('generate_organization_jsonld', { org_id: organizationId });
      
      if (jsonldError) {
        console.error('Error generating organization JSON-LD:', jsonldError);
        return NextResponse.json({ error: 'Failed to generate organization JSON-LD' }, { status: 500 });
      }
      
      jsonldData = jsonldResult;
      content = JSON.stringify(jsonldData, null, 2);
      contentType = 'application/ld+json';
      fileTypeForDb = 'organization-jsonld';
    } else {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }
    
    // Store or update the file in llm_discovery_files
    const filePath = `/data/organizations/${slug}/${fileType}`;
    const { error: upsertError } = await supabase
      .from('llm_discovery_files')
      .upsert({
        file_path: filePath,
        file_type: fileTypeForDb,
        entity_type: 'organization',
        entity_id: organizationId,
        entity_slug: slug,
        content_type: fileType.endsWith('.jsonld') ? 'jsonld' : 'markdown',
        content: content,
        jsonld_data: jsonldData,
        last_generated: new Date().toISOString()
      }, {
        onConflict: 'file_path'
      });
    
    if (upsertError) {
      console.error('Error storing organization file:', upsertError);
    }
    
    // Return the content
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': `${contentType}; charset=utf-8`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
    
  } catch (error) {
    console.error('Error in organization file generation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { slug } = await params;
    
    // Get the file type from the URL path
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const fileType = pathSegments[pathSegments.length - 1];
    
    // Get organization ID from slug
    const { data: orgSlug, error: slugError } = await supabase
      .from('organization_slugs')
      .select('organization_id')
      .eq('slug', slug)
      .single();
    
    if (slugError || !orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    
    const organizationId = orgSlug.organization_id;
    
    // Force regenerate content
    let content: string;
    let fileTypeForDb: string;
    let jsonldData: any = null;
    
    if (fileType === 'organization-llms.txt') {
      const { data: indexContent, error: indexError } = await supabase.rpc('generate_organization_index', { org_id: organizationId });
      
      if (indexError) {
        console.error('Error regenerating organization index:', indexError);
        return NextResponse.json({ error: 'Failed to regenerate organization index' }, { status: 500 });
      }
      
      content = indexContent;
      fileTypeForDb = 'organization-index';
    } else if (fileType === 'organization.jsonld') {
      const { data: jsonldResult, error: jsonldError } = await supabase.rpc('generate_organization_jsonld', { org_id: organizationId });
      
      if (jsonldError) {
        console.error('Error regenerating organization JSON-LD:', jsonldError);
        return NextResponse.json({ error: 'Failed to regenerate organization JSON-LD' }, { status: 500 });
      }
      
      jsonldData = jsonldResult;
      content = JSON.stringify(jsonldData, null, 2);
      fileTypeForDb = 'organization-jsonld';
    } else {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }
    
    // Update the file in llm_discovery_files
    const filePath = `/data/organizations/${slug}/${fileType}`;
    const { error: upsertError } = await supabase
      .from('llm_discovery_files')
      .upsert({
        file_path: filePath,
        file_type: fileTypeForDb,
        entity_type: 'organization',
        entity_id: organizationId,
        entity_slug: slug,
        content_type: fileType.endsWith('.jsonld') ? 'jsonld' : 'markdown',
        content: content,
        jsonld_data: jsonldData,
        last_generated: new Date().toISOString()
      }, {
        onConflict: 'file_path'
      });
    
    if (upsertError) {
      console.error('Error updating organization file:', upsertError);
      return NextResponse.json({ error: 'Failed to update organization file' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Organization file regenerated successfully',
      last_generated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in organization file regeneration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 