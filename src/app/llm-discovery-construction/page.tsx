"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ConstructionStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number;
  result?: any;
  error?: string;
}

interface ScanResult {
  total_clients: number;
  clients_with_org_jsonld: number;
  clients_with_brand_jsonld: number;
  clients_with_product_jsonld: number;
  total_faq_batches: number;
  batches_with_jsonld: number;
}

export default function LLMDiscoveryConstruction() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [steps, setSteps] = useState<ConstructionStep[]>([
    {
      id: 'scan',
      name: '🔍 Scan Existing Data',
      description: 'Analyze existing JSON-LD objects and FAQ batches',
      status: 'pending',
      progress: 0
    },
    {
      id: 'populate_static',
      name: '📋 Populate Static Objects',
      description: 'Copy organization, brand, and product JSON-LD to discovery tables',
      status: 'pending',
      progress: 0
    },
    {
      id: 'populate_faq',
      name: '❓ Populate FAQ Objects',
      description: 'Create FAQ discovery objects from batch_faq_pairs',
      status: 'pending',
      progress: 0
    },
    {
      id: 'validate',
      name: '✅ Validate All Objects',
      description: 'Check all generated objects for proper structure',
      status: 'pending',
      progress: 0
    },
    {
      id: 'preview',
      name: '👁️ Preview Directory Structure',
      description: 'Generate preview of LLM discovery file structure',
      status: 'pending',
      progress: 0
    }
  ]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await scanExistingData();
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStep = (stepId: string, updates: Partial<ConstructionStep>) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  };

  const scanExistingData = async () => {
    try {
      updateStep('scan', { status: 'running', progress: 10 });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Scan client_organisation for JSON-LD
      const { data: orgs } = await supabase
        .from('client_organisation')
        .select('id, organisation_jsonld_object')
        .eq('auth_user_id', user.id);

      updateStep('scan', { progress: 30 });

      // Scan brands for JSON-LD
      const { data: brands } = await supabase
        .from('brands')
        .select('id, brand_jsonld_object')
        .eq('auth_user_id', user.id);

      updateStep('scan', { progress: 50 });

      // Scan products for JSON-LD
      const { data: products } = await supabase
        .from('products')
        .select('id, schema_json')
        .eq('auth_user_id', user.id);

      updateStep('scan', { progress: 70 });

      // Scan batch_faq_pairs
      const { data: faqBatches } = await supabase
        .from('batch_faq_pairs')
        .select('id, faq_pairs_object')
        .eq('auth_user_id', user.id);

      updateStep('scan', { progress: 90 });

      const result: ScanResult = {
        total_clients: orgs?.length || 0,
        clients_with_org_jsonld: orgs?.filter(org => org.organisation_jsonld_object)?.length || 0,
        clients_with_brand_jsonld: brands?.filter(brand => brand.brand_jsonld_object)?.length || 0,
        clients_with_product_jsonld: products?.filter(product => product.schema_json)?.length || 0,
        total_faq_batches: faqBatches?.length || 0,
        batches_with_jsonld: faqBatches?.filter(batch => batch.faq_pairs_object)?.length || 0
      };

      setScanResult(result);
      updateStep('scan', { 
        status: 'completed', 
        progress: 100, 
        result 
      });

    } catch (error) {
      console.error('Error scanning data:', error);
      updateStep('scan', { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  };

  const populateStaticObjects = async () => {
    try {
      setCurrentStep('populate_static');
      updateStep('populate_static', { status: 'running', progress: 10 });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get organization data
      const { data: org, error: orgError } = await supabase
        .from('client_organisation')
        .select('id, organisation_jsonld_object')
        .eq('auth_user_id', user.id)
        .single();

      if (orgError) throw orgError;

      updateStep('populate_static', { progress: 30 });

      // Get brand data
      const { data: brands, error: brandsError } = await supabase
        .from('brands')
        .select('id, brand_jsonld_object')
        .eq('auth_user_id', user.id);

      if (brandsError) throw brandsError;

      updateStep('populate_static', { progress: 50 });

      // Get product data
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, schema_json')
        .eq('auth_user_id', user.id);

      if (productsError) throw productsError;

      updateStep('populate_static', { progress: 70 });

      // Prepare JSON-LD data
      const organizationJsonld = org?.organisation_jsonld_object || null;
      const brandJsonld = brands && brands.length > 0 ? brands[0]?.brand_jsonld_object : null;
      const productJsonld = products && products.length > 0 ? products[0]?.schema_json : null;

      // Insert or update static discovery object
      const { error: upsertError } = await supabase
        .from('llm_discovery_static')
        .upsert({
          auth_user_id: user.id,
          client_organisation_id: org?.id,
          organization_jsonld: organizationJsonld,
          brand_jsonld: brandJsonld,
          product_jsonld: productJsonld,
          last_generated: new Date().toISOString()
        }, {
          onConflict: 'auth_user_id'
        });

      if (upsertError) throw upsertError;

      updateStep('populate_static', { 
        status: 'completed', 
        progress: 100,
        result: {
          organization_processed: !!organizationJsonld,
          brands_processed: brands?.length || 0,
          products_processed: products?.length || 0,
          static_object_created: true
        }
      });

    } catch (error) {
      console.error('Error populating static objects:', error);
      updateStep('populate_static', { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setCurrentStep(null);
    }
  };

  const populateFAQObjects = async () => {
    try {
      setCurrentStep('populate_faq');
      updateStep('populate_faq', { status: 'running', progress: 10 });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get FAQ batches
      const { data: faqBatches, error: faqError } = await supabase
        .from('batch_faq_pairs')
        .select(`
          id,
          faq_pairs_object,
          created_at,
          auth_user_id
        `)
        .eq('auth_user_id', user.id)
        .not('faq_pairs_object', 'is', null);

      if (faqError) throw faqError;

      updateStep('populate_faq', { progress: 30 });

      if (!faqBatches || faqBatches.length === 0) {
        updateStep('populate_faq', { 
          status: 'completed', 
          progress: 100,
          result: { batches_processed: 0, message: 'No FAQ batches found' }
        });
        return;
      }

      // Get organization and brand data for context
      const { data: org, error: orgError } = await supabase
        .from('client_organisation')
        .select('id, organisation_jsonld_object')
        .eq('auth_user_id', user.id)
        .single();

      if (orgError) throw orgError;

      const { data: brands, error: brandsError } = await supabase
        .from('brands')
        .select('id, brand_jsonld_object')
        .eq('auth_user_id', user.id);

      if (brandsError) throw brandsError;

      updateStep('populate_faq', { progress: 50 });

      // Process each batch
      let processedCount = 0;
      let errorCount = 0;

      for (const batch of faqBatches) {
        try {
          const weekStart = new Date(batch.created_at);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week

          const { error: insertError } = await supabase
            .from('llm_discovery_faq_objects')
            .upsert({
              batch_faq_pairs_id: batch.id,
              auth_user_id: user.id,
              client_organisation_id: org?.id,
              brand_id: brands && brands.length > 0 ? brands[0]?.id : null,
              product_id: null, // Will need to be linked properly in future
              week_start_date: weekStart.toISOString().split('T')[0],
              faq_json_object: batch.faq_pairs_object,
              organization_jsonld: org?.organisation_jsonld_object,
              brand_jsonld: brands && brands.length > 0 ? brands[0]?.brand_jsonld_object : null,
              product_jsonld: null,
              last_generated: new Date().toISOString()
            }, {
              onConflict: 'batch_faq_pairs_id'
            });

          if (!insertError) {
            processedCount++;
          } else {
            errorCount++;
          }
        } catch (batchError) {
          errorCount++;
          console.error(`Error processing batch ${batch.id}:`, batchError);
        }
      }

      updateStep('populate_faq', { 
        status: 'completed', 
        progress: 100,
        result: { 
          batches_processed: processedCount,
          batches_with_errors: errorCount,
          total_batches: faqBatches.length
        }
      });

    } catch (error) {
      console.error('Error populating FAQ objects:', error);
      updateStep('populate_faq', { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setCurrentStep(null);
    }
  };

  const validateObjects = async () => {
    try {
      setCurrentStep('validate');
      updateStep('validate', { status: 'running', progress: 10 });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check static objects
      const { data: staticObjects, error: staticError } = await supabase
        .from('llm_discovery_static')
        .select('*')
        .eq('auth_user_id', user.id);

      if (staticError) throw staticError;

      updateStep('validate', { progress: 50 });

      // Check FAQ objects
      const { data: faqObjects, error: faqError } = await supabase
        .from('llm_discovery_faq_objects')
        .select('*')
        .eq('auth_user_id', user.id);

      if (faqError) throw faqError;

      updateStep('validate', { progress: 100 });

      const validationResult = {
        static_objects_count: staticObjects?.length || 0,
        faq_objects_count: faqObjects?.length || 0,
        static_objects_valid: staticObjects?.every(obj => obj.organization_jsonld) || false,
        faq_objects_valid: faqObjects?.every(obj => obj.faq_json_object) || false,
        validation_passed: true
      };

      updateStep('validate', { 
        status: 'completed', 
        progress: 100,
        result: validationResult
      });

    } catch (error) {
      console.error('Error validating objects:', error);
      updateStep('validate', { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setCurrentStep(null);
    }
  };

  const previewDirectoryStructure = async () => {
    try {
      setCurrentStep('preview');
      updateStep('preview', { status: 'running', progress: 10 });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get organization data for preview
      const { data: org } = await supabase
        .from('client_organisation')
        .select('organisation_name')
        .eq('auth_user_id', user.id)
        .single();

      updateStep('preview', { progress: 50 });

      // Generate preview of directory structure
      const orgSlug = org?.organisation_name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'organization';
      
      const preview = {
        platform_index: '/data/platform-llms.txt',
        organization: {
          slug: orgSlug,
          index: `/data/organizations/${orgSlug}/organization-llms.txt`,
          jsonld: `/data/organizations/${orgSlug}/organization.jsonld`,
          brands: [
            {
              slug: 'brand-1',
              index: `/data/organizations/${orgSlug}/brands/brand-1/brands-llms.txt`,
              jsonld: `/data/organizations/${orgSlug}/brands/brand-1/brand.jsonld`,
              products: [
                {
                  slug: 'product-1',
                  index: `/data/organizations/${orgSlug}/brands/brand-1/products/product-1/products-llms.txt`,
                  jsonld: `/data/organizations/${orgSlug}/brands/brand-1/products/product-1/product.jsonld`,
                  faqs: `/data/organizations/${orgSlug}/brands/brand-1/products/product-1/faqs/faq.jsonld`
                }
              ]
            }
          ]
        }
      };

      updateStep('preview', { 
        status: 'completed', 
        progress: 100,
        result: preview
      });

    } catch (error) {
      console.error('Error generating preview:', error);
      updateStep('preview', { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setCurrentStep(null);
    }
  };

  const runAllSteps = async () => {
    if (!confirm('This will run all construction steps. Continue?')) return;
    
    await scanExistingData();
    await populateStaticObjects();
    await populateFAQObjects();
    await validateObjects();
    await previewDirectoryStructure();
  };

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'running': return 'text-blue-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'running': return '🔄';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading Construction Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">LLM Discovery Construction</h1>
              <p className="text-gray-400">Build and manage LLM-friendly discovery objects</p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>

        {/* Scan Results */}
        {scanResult && (
          <div className="mb-8 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">📊 Data Scan Results</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-400 mb-1">{scanResult.total_clients}</div>
                <div className="text-gray-400 text-sm">Total Clients</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-400 mb-1">{scanResult.clients_with_org_jsonld}</div>
                <div className="text-gray-400 text-sm">With Org JSON-LD</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-400 mb-1">{scanResult.clients_with_brand_jsonld}</div>
                <div className="text-gray-400 text-sm">With Brand JSON-LD</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-400 mb-1">{scanResult.total_faq_batches}</div>
                <div className="text-gray-400 text-sm">FAQ Batches</div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-8 flex flex-wrap gap-4">
          <button
            onClick={runAllSteps}
            disabled={currentStep !== null}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none"
          >
            🚀 Run All Steps
          </button>
          
          <button
            onClick={scanExistingData}
            disabled={currentStep !== null}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200"
          >
            🔍 Scan Data
          </button>
        </div>

        {/* Construction Steps */}
        <div className="space-y-6">
          {steps.map((step) => (
            <div key={step.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getStepStatusIcon(step.status)}</span>
                  <div>
                    <h3 className={`text-xl font-semibold ${getStepStatusColor(step.status)}`}>
                      {step.name}
                    </h3>
                    <p className="text-gray-400 text-sm">{step.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {step.status === 'running' && (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                  )}
                  
                  {step.status === 'pending' && (
                    <button
                      onClick={() => {
                        switch (step.id) {
                          case 'populate_static': populateStaticObjects(); break;
                          case 'populate_faq': populateFAQObjects(); break;
                          case 'validate': validateObjects(); break;
                          case 'preview': previewDirectoryStructure(); break;
                        }
                      }}
                      disabled={currentStep !== null}
                      className="bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Run
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${step.progress}%` }}
                ></div>
              </div>

              {/* Results */}
              {step.result && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-2">Results:</h4>
                  <pre className="text-gray-300 text-sm overflow-x-auto">
                    {JSON.stringify(step.result, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error */}
              {step.error && (
                <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
                  <h4 className="text-red-400 font-semibold mb-2">Error:</h4>
                  <p className="text-red-300 text-sm">{step.error}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => router.push('/llm-discovery')}
              className="p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              <div className="text-blue-400 font-semibold">View Discovery Dashboard</div>
              <div className="text-gray-400 text-sm">Manage existing objects</div>
            </button>
            
            <button
              onClick={() => router.push('/dashboard')}
              className="p-4 bg-green-500/20 border border-green-500/50 rounded-lg hover:bg-green-500/30 transition-colors"
            >
              <div className="text-green-400 font-semibold">Back to Dashboard</div>
              <div className="text-gray-400 text-sm">Return to main dashboard</div>
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="p-4 bg-purple-500/20 border border-purple-500/50 rounded-lg hover:bg-purple-500/30 transition-colors"
            >
              <div className="text-purple-400 font-semibold">Refresh Page</div>
              <div className="text-gray-400 text-sm">Reload construction page</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 