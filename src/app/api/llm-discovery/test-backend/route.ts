import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Test 1: Check static objects
    const { data: staticObjects, error: staticError } = await supabase
      .from('llm_discovery_static')
      .select('*')
      .eq('auth_user_id', user.id);

    if (staticError) {
      return NextResponse.json({ error: `Static objects error: ${staticError.message}` }, { status: 500 });
    }

    // Test 2: Check FAQ objects
    const { data: faqObjects, error: faqError } = await supabase
      .from('llm_discovery_faq_objects')
      .select('*')
      .eq('auth_user_id', user.id);

    if (faqError) {
      return NextResponse.json({ error: `FAQ objects error: ${faqError.message}` }, { status: 500 });
    }

    // Test 3: Check organization data
    const { data: orgData, error: orgError } = await supabase
      .from('client_organisation')
      .select('id, organisation, organisation_jsonld_object')
      .eq('auth_user_id', user.id)
      .single();

    // Test 4: Check brand data
    const { data: brandData, error: brandError } = await supabase
      .from('brands')
      .select('id, brand_name, brand_jsonld_object')
      .eq('auth_user_id', user.id);

    // Test 5: Check product data
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('id, product_name, schema_json')
      .eq('auth_user_id', user.id);

    // Test 6: Check batch FAQ pairs
    const { data: batchData, error: batchError } = await supabase
      .from('batch_faq_pairs')
      .select('id, unique_batch_id, faq_pairs_object')
      .eq('auth_user_id', user.id);

    const results = {
      user_id: user.id,
      timestamp: new Date().toISOString(),
      tests: {
        static_objects: {
          count: staticObjects?.length || 0,
          has_data: staticObjects && staticObjects.length > 0,
          sample: staticObjects?.[0] ? {
            id: staticObjects[0].id,
            has_org_jsonld: !!staticObjects[0].organization_jsonld,
            has_brand_jsonld: !!staticObjects[0].brand_jsonld,
            has_product_jsonld: !!staticObjects[0].product_jsonld,
            is_active: staticObjects[0].is_active,
            created_at: staticObjects[0].created_at
          } : null
        },
        faq_objects: {
          count: faqObjects?.length || 0,
          has_data: faqObjects && faqObjects.length > 0,
          sample: faqObjects?.[0] ? {
            id: faqObjects[0].id,
            batch_faq_pairs_id: faqObjects[0].batch_faq_pairs_id,
            has_faq_json: !!faqObjects[0].faq_json_object,
            has_org_jsonld: !!faqObjects[0].organization_jsonld,
            has_brand_jsonld: !!faqObjects[0].brand_jsonld,
            week_start_date: faqObjects[0].week_start_date,
            created_at: faqObjects[0].created_at
          } : null
        },
        source_data: {
          organization: {
            exists: !!orgData,
            has_jsonld: orgData ? !!orgData.organisation_jsonld_object : false,
            name: orgData?.organisation || null
          },
          brands: {
            count: brandData?.length || 0,
            has_jsonld: brandData ? brandData.some(b => b.brand_jsonld_object) : false
          },
          products: {
            count: productData?.length || 0,
            has_jsonld: productData ? productData.some(p => p.schema_json) : false
          },
          batch_faq_pairs: {
            count: batchData?.length || 0,
            has_jsonld: batchData ? batchData.some(b => b.faq_pairs_object) : false
          }
        }
      },
      summary: {
        backend_populated: staticObjects && staticObjects.length > 0,
        faq_objects_populated: faqObjects && faqObjects.length > 0,
        total_objects: (staticObjects?.length || 0) + (faqObjects?.length || 0),
        source_data_available: !!(orgData || (brandData && brandData.length > 0) || (productData && productData.length > 0) || (batchData && batchData.length > 0))
      }
    };

    return NextResponse.json(results);

  } catch (error) {
    console.error('Test backend error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 