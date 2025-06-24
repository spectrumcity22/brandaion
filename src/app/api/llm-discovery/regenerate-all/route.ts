import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get all active organizations
    const { data: organizations, error: orgError } = await supabase
      .from('client_organisation')
      .select('id, organisation_name')
      .eq('is_active', true);
    
    if (orgError) {
      console.error('Error fetching organizations:', orgError);
      return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
    }
    
    const results = {
      platform_index: false,
      organizations: [] as any[],
      total_processed: 0,
      errors: [] as string[]
    };
    
    // 1. Regenerate platform index
    try {
      const { data: platformIndex, error: platformError } = await supabase.rpc('generate_platform_index');
      
      if (platformError) {
        results.errors.push(`Platform index: ${platformError.message}`);
      } else {
        // Store platform index
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
          results.errors.push(`Platform index storage: ${upsertError.message}`);
        } else {
          results.platform_index = true;
          results.total_processed++;
        }
      }
    } catch (error) {
      results.errors.push(`Platform index generation failed: ${error}`);
    }
    
    // 2. Regenerate organization files
    for (const org of organizations || []) {
      const orgResult = {
        id: org.id,
        name: org.organisation_name,
        index_generated: false,
        jsonld_generated: false,
        slug: null as string | null
      };
      
      try {
        // Get organization slug
        const { data: orgSlug } = await supabase
          .from('organization_slugs')
          .select('slug')
          .eq('organization_id', org.id)
          .single();
        
        if (orgSlug) {
          orgResult.slug = orgSlug.slug;
          
          // Generate organization index
          const { data: indexContent, error: indexError } = await supabase.rpc('generate_organization_index', { org_id: org.id });
          
          if (!indexError && indexContent) {
            const { error: indexUpsertError } = await supabase
              .from('llm_discovery_files')
              .upsert({
                file_path: `/data/organizations/${orgSlug.slug}/organization-llms.txt`,
                file_type: 'organization-index',
                entity_type: 'organization',
                entity_id: org.id,
                entity_slug: orgSlug.slug,
                content_type: 'markdown',
                content: indexContent,
                jsonld_data: null,
                last_generated: new Date().toISOString()
              }, {
                onConflict: 'file_path'
              });
            
            if (!indexUpsertError) {
              orgResult.index_generated = true;
              results.total_processed++;
            } else {
              results.errors.push(`${org.organisation_name} index storage: ${indexUpsertError.message}`);
            }
          } else {
            results.errors.push(`${org.organisation_name} index generation: ${indexError?.message || 'Unknown error'}`);
          }
          
          // Generate organization JSON-LD
          const { data: jsonldData, error: jsonldError } = await supabase.rpc('generate_organization_jsonld', { org_id: org.id });
          
          if (!jsonldError && jsonldData) {
            const { error: jsonldUpsertError } = await supabase
              .from('llm_discovery_files')
              .upsert({
                file_path: `/data/organizations/${orgSlug.slug}/organization.jsonld`,
                file_type: 'organization-jsonld',
                entity_type: 'organization',
                entity_id: org.id,
                entity_slug: orgSlug.slug,
                content_type: 'jsonld',
                content: JSON.stringify(jsonldData, null, 2),
                jsonld_data: jsonldData,
                last_generated: new Date().toISOString()
              }, {
                onConflict: 'file_path'
              });
            
            if (!jsonldUpsertError) {
              orgResult.jsonld_generated = true;
              results.total_processed++;
            } else {
              results.errors.push(`${org.organisation_name} JSON-LD storage: ${jsonldUpsertError.message}`);
            }
          } else {
            results.errors.push(`${org.organisation_name} JSON-LD generation: ${jsonldError?.message || 'Unknown error'}`);
          }
        } else {
          results.errors.push(`${org.organisation_name}: No slug found`);
        }
      } catch (error) {
        results.errors.push(`${org.organisation_name}: ${error}`);
      }
      
      results.organizations.push(orgResult);
    }
    
    return NextResponse.json({
      success: true,
      message: 'LLM discovery files regeneration completed',
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in regenerate all:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get status of all discovery files
    const { data: files, error } = await supabase
      .from('llm_discovery_files')
      .select('*')
      .order('last_generated', { ascending: false });
    
    if (error) {
      console.error('Error fetching discovery files:', error);
      return NextResponse.json({ error: 'Failed to fetch discovery files' }, { status: 500 });
    }
    
    // Group files by type
    const stats = {
      total_files: files?.length || 0,
      by_type: {} as any,
      by_entity: {} as any,
      recent_updates: files?.slice(0, 10) || []
    };
    
    files?.forEach(file => {
      // Count by file type
      if (!stats.by_type[file.file_type]) {
        stats.by_type[file.file_type] = 0;
      }
      stats.by_type[file.file_type]++;
      
      // Count by entity type
      if (!stats.by_entity[file.entity_type]) {
        stats.by_entity[file.entity_type] = 0;
      }
      stats.by_entity[file.entity_type]++;
    });
    
    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting discovery status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 