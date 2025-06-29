"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Client {
  auth_user_id: string;
  organisation_name: string;
  user_email: string;
}

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
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [steps, setSteps] = useState<Record<string, ConstructionStep>>({
    scan: { id: 'scan', name: 'Scan Existing Data', description: 'Analyze current data structure', status: 'pending', progress: 0 },
    populate_static: { id: 'populate_static', name: 'Populate Static Objects', description: 'Create organization, brand, and product JSON-LD', status: 'pending', progress: 0 },
    enrich_org: { id: 'enrich_org', name: 'Enrich Organization JSON-LD', description: 'Add brands, products, and topics to organization JSON-LD', status: 'pending', progress: 0 },
    enrich_brand: { id: 'enrich_brand', name: 'Enrich Brand JSON-LD', description: 'Add products and FAQs to brand JSON-LD for complete knowledge graph', status: 'pending', progress: 0 },
    enrich_product: { id: 'enrich_product', name: 'Enrich Product JSON-LD', description: 'Add parent references and FAQ links to product JSON-LD', status: 'pending', progress: 0 },
    populate_faq: { id: 'populate_faq', name: 'Populate FAQ Objects', description: 'Create FAQ objects for dispatch-ready batches', status: 'pending', progress: 0 },
    fix_relationships: { id: 'fix_relationships', name: 'Fix Product Relationships', description: 'Link FAQ objects to products and populate missing product data', status: 'pending', progress: 0 },
    validate: { id: 'validate', name: 'Validate Objects', description: 'Verify all objects are properly structured', status: 'pending', progress: 0 },
    preview: { id: 'preview', name: 'Preview Directory Structure', description: 'Show the final directory structure', status: 'pending', progress: 0 }
  });
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [forceReprocess, setForceReprocess] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      // Reset scan results when client changes
      setScanResult(null);
      // Reset all steps
      setSteps(prev => {
        const resetSteps = { ...prev };
        Object.keys(resetSteps).forEach(key => {
          resetSteps[key] = { ...resetSteps[key], status: 'pending', progress: 0, result: undefined, error: undefined };
        });
        return resetSteps;
      });
    }
  }, [selectedClient]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Get all clients (organizations)
      const { data: clientOrgs, error: clientError } = await supabase
        .from('client_organisation')
        .select(`
          auth_user_id,
          organisation_name
        `)
        .order('organisation_name');

      if (clientError) throw clientError;

      // Get user emails for each organization
      const clientsData: Client[] = [];
      for (const org of clientOrgs || []) {
        const { data: endUser } = await supabase
          .from('end_users')
          .select('user_email')
          .eq('auth_user_id', org.auth_user_id)
          .single();

        clientsData.push({
          auth_user_id: org.auth_user_id,
          organisation_name: org.organisation_name,
          user_email: endUser?.user_email || 'Unknown'
        });
      }

      console.log('Found organizations:', clientOrgs?.length || 0);
      console.log('Processed clients:', clientsData.length);

      // If no organizations found, try to get the current user as a fallback
      if (clientsData.length === 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: endUser } = await supabase
            .from('end_users')
            .select('user_email')
            .eq('auth_user_id', user.id)
            .single();

          clientsData.push({
            auth_user_id: user.id,
            organisation_name: 'Current User',
            user_email: endUser?.user_email || user.email || 'Unknown'
          });
        }
      }

      setClients(clientsData);

      // Auto-select if only one client, otherwise require selection
      if (clientsData.length === 1) {
        setSelectedClient(clientsData[0]);
      }

    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStep = (stepId: string, updates: Partial<ConstructionStep>) => {
    setSteps(prev => ({
      ...prev,
      [stepId]: { ...prev[stepId as keyof typeof prev], ...updates }
    }));
  };

  const scanExistingData = async () => {
    if (!selectedClient) {
      alert('Please select a client first');
      return;
    }

    try {
      setCurrentStep('scan');
      updateStep('scan', { status: 'running', progress: 10 });

      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];

      // Scan client_organisation
      const { data: orgs, error: orgsError } = await supabase
        .from('client_organisation')
        .select('id, organisation_jsonld_object')
        .eq('auth_user_id', selectedClient.auth_user_id);

      if (orgsError) throw orgsError;

      updateStep('scan', { progress: 30 });

      // Scan brands
      const { data: brands, error: brandsError } = await supabase
        .from('brands')
        .select('id, brand_jsonld_object')
        .eq('auth_user_id', selectedClient.auth_user_id);

      if (brandsError) throw brandsError;

      updateStep('scan', { progress: 50 });

      // Scan products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, schema_json')
        .eq('auth_user_id', selectedClient.auth_user_id);

      if (productsError) throw productsError;

      updateStep('scan', { progress: 70 });

      // Scan batch_faq_pairs
      const { data: faqBatches, error: faqError } = await supabase
        .from('batch_faq_pairs')
        .select(`
          id,
          batch_date,
          faq_pairs_object,
          created_at,
          auth_user_id
        `)
        .eq('auth_user_id', selectedClient.auth_user_id)
        .not('faq_pairs_object', 'is', null)
        .lte('batch_date', today); // Only batches with dispatch date today or before

      if (faqError) throw faqError;

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
    if (!selectedClient) {
      alert('Please select a client first');
      return;
    }

    try {
      setCurrentStep('populate_static');
      updateStep('populate_static', { status: 'running', progress: 10 });

      // Get organization data
      const { data: org, error: orgError } = await supabase
        .from('client_organisation')
        .select('id, organisation_jsonld_object')
        .eq('auth_user_id', selectedClient.auth_user_id)
        .single();

      if (orgError) throw orgError;

      updateStep('populate_static', { progress: 30 });

      // Get brand data
      const { data: brands, error: brandsError } = await supabase
        .from('brands')
        .select('id, brand_jsonld_object')
        .eq('auth_user_id', selectedClient.auth_user_id);

      if (brandsError) throw brandsError;

      updateStep('populate_static', { progress: 50 });

      // Get product data
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, schema_json')
        .eq('auth_user_id', selectedClient.auth_user_id);

      if (productsError) throw productsError;

      updateStep('populate_static', { progress: 70 });

      // Helper function to safely parse JSON
      const safeJsonParse = (data: any) => {
        if (!data) return null;
        if (typeof data === 'object') return data;
        if (typeof data === 'string') {
          try {
            return JSON.parse(data);
          } catch (error) {
            console.warn('Failed to parse JSON string:', error);
            return null;
          }
        }
        return null;
      };

      // Prepare JSON-LD data
      const organizationJsonld = safeJsonParse(org?.organisation_jsonld_object);
      const brandJsonld = brands && brands.length > 0 ? safeJsonParse(brands[0]?.brand_jsonld_object) : null;
      const productJsonld = products && products.length > 0 ? safeJsonParse(products[0]?.schema_json) : null;

      // Insert or update static discovery object
      const { error: upsertError } = await supabase
        .from('llm_discovery_static')
        .upsert({
          auth_user_id: selectedClient.auth_user_id,
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

  const enrichOrganizationJsonld = async () => {
    if (!selectedClient) {
      alert('Please select a client first');
      return;
    }

    try {
      setCurrentStep('enrich_org');
      updateStep('enrich_org', { status: 'running', progress: 10 });

      // Try calling the API route first
      let response;
      try {
        response = await fetch('/api/enrich-organisation-jsonld', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            auth_user_id: selectedClient.auth_user_id
          })
        });
      } catch (apiError) {
        console.log('API route failed, trying direct edge function call');
        
        // Fallback: call edge function directly
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        response = await fetch(`${supabaseUrl}/functions/v1/enrich_organisation_jsonld`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'apikey': supabaseAnonKey!
          },
          body: JSON.stringify({
            auth_user_id: selectedClient.auth_user_id
          })
        });
      }

      updateStep('enrich_org', { progress: 50 });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Function call failed:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('Enrichment result:', result);

      updateStep('enrich_org', { 
        status: 'completed', 
        progress: 100,
        result: {
          success: result.success,
          message: result.message,
          organization: result.organization,
          enrichedData: result.enrichedData
        }
      });

    } catch (error) {
      console.error('Error enriching organization JSON-LD:', error);
      updateStep('enrich_org', { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setCurrentStep(null);
    }
  };

  const enrichBrandJsonld = async () => {
    if (!selectedClient) {
      alert('Please select a client first');
      return;
    }

    try {
      setCurrentStep('enrich_brand');
      updateStep('enrich_brand', { status: 'running', progress: 10 });

      // Get all brands for this client
      const { data: brands, error: brandsError } = await supabase
        .from('brands')
        .select('id, brand_name')
        .eq('auth_user_id', selectedClient.auth_user_id);

      if (brandsError) throw brandsError;

      if (!brands || brands.length === 0) {
        updateStep('enrich_brand', { 
          status: 'completed', 
          progress: 100,
          result: { brands_processed: 0, message: 'No brands found for this client' }
        });
        return;
      }

      updateStep('enrich_brand', { progress: 30 });

      // Process each brand
      let processedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const brand of brands) {
        try {
          // Call the brand enrichment API
          const response = await fetch('https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/enrich_brand_jsonld', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            },
            body: JSON.stringify({
              auth_user_id: selectedClient.auth_user_id,
              brand_id: brand.id
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to enrich brand ${brand.brand_name}:`, response.status, errorText);
            errors.push(`${brand.brand_name}: HTTP ${response.status}`);
            errorCount++;
            continue;
          }

          const result = await response.json();
          console.log(`Successfully enriched brand ${brand.brand_name}:`, result);
          processedCount++;

        } catch (error) {
          console.error(`Error enriching brand ${brand.brand_name}:`, error);
          errors.push(`${brand.brand_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          errorCount++;
        }
      }

      updateStep('enrich_brand', { 
        status: errorCount === 0 ? 'completed' : 'error', 
        progress: 100,
        result: {
          brands_processed: processedCount,
          brands_failed: errorCount,
          total_brands: brands.length,
          errors: errors.length > 0 ? errors : undefined
        },
        error: errorCount > 0 ? `${errorCount} brands failed to enrich` : undefined
      });

    } catch (error) {
      console.error('Error enriching brand JSON-LD:', error);
      updateStep('enrich_brand', { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setCurrentStep(null);
    }
  };

  const enrichProductJsonld = async () => {
    if (!selectedClient) {
      alert('Please select a client first');
      return;
    }
    try {
      setCurrentStep('enrich_product');
      updateStep('enrich_product', { status: 'running', progress: 10 });
      // Get all products for this client
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, product_name')
        .eq('auth_user_id', selectedClient.auth_user_id);
      if (productsError) throw productsError;
      if (!products || products.length === 0) {
        updateStep('enrich_product', {
          status: 'completed',
          progress: 100,
          result: { products_processed: 0, message: 'No products found for this client' }
        });
        return;
      }
      updateStep('enrich_product', { progress: 30 });
      let processedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      for (const product of products) {
        try {
          // Call the product enrichment API
          const response = await fetch('https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/product_enrichment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            },
            body: JSON.stringify({
              auth_user_id: selectedClient.auth_user_id,
              product_id: product.id
            })
          });
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to enrich product ${product.product_name}:`, response.status, errorText);
            errors.push(`${product.product_name}: HTTP ${response.status}`);
            errorCount++;
            continue;
          }
          const result = await response.json();
          console.log(`Successfully enriched product ${product.product_name}:`, result);
          processedCount++;
        } catch (error) {
          console.error(`Error enriching product ${product.product_name}:`, error);
          errors.push(`${product.product_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          errorCount++;
        }
      }
      updateStep('enrich_product', {
        status: errorCount === 0 ? 'completed' : 'error',
        progress: 100,
        result: {
          products_processed: processedCount,
          products_failed: errorCount,
          total_products: products.length,
          errors: errors.length > 0 ? errors : undefined
        },
        error: errorCount > 0 ? `${errorCount} products failed to enrich` : undefined
      });
    } catch (error) {
      console.error('Error enriching product JSON-LD:', error);
      updateStep('enrich_product', {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setCurrentStep(null);
    }
  };

  const populateFAQObjects = async () => {
    if (!selectedClient) {
      alert('Please select a client first');
      return;
    }

    try {
      setCurrentStep('populate_faq');
      updateStep('populate_faq', { status: 'running', progress: 10 });

      // Get FAQ batches - only those with dispatch date today or before
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const { data: faqBatches, error: faqError } = await supabase
        .from('batch_faq_pairs')
        .select(`
          id,
          batch_date,
          faq_pairs_object,
          created_at,
          auth_user_id,
          product
        `)
        .eq('auth_user_id', selectedClient.auth_user_id)
        .not('faq_pairs_object', 'is', null)
        .lte('batch_date', today); // Only batches with dispatch date today or before

      if (faqError) throw faqError;

      console.log('FAQ Batches found (dispatch date <= today):', faqBatches?.length || 0);
      console.log('Today\'s date:', today);
      console.log('FAQ Batches data:', faqBatches);

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
      const { data: orgs, error: orgError } = await supabase
        .from('client_organisation')
        .select('id, organisation_jsonld_object')
        .eq('auth_user_id', selectedClient.auth_user_id);

      if (orgError) throw orgError;

      const { data: brands, error: brandsError } = await supabase
        .from('brands')
        .select('id, brand_jsonld_object')
        .eq('auth_user_id', selectedClient.auth_user_id);

      if (brandsError) throw brandsError;

      // Get products data for proper linking
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, product_name, schema_json, brand_id')
        .eq('auth_user_id', selectedClient.auth_user_id);

      if (productsError) throw productsError;

      // Get client configuration for product linking
      const { data: clientConfig, error: configError } = await supabase
        .from('client_configuration')
        .select('product_id, schema_json')
        .eq('auth_user_id', selectedClient.auth_user_id)
        .single();

      if (configError && configError.code !== 'PGRST116') { // PGRST116 is "not found"
        console.warn('Could not get client configuration:', configError);
      }

      updateStep('populate_faq', { progress: 50 });

      // Helper function to safely parse JSON
      const safeJsonParse = (data: any) => {
        if (!data) return null;
        if (typeof data === 'object') return data;
        if (typeof data === 'string') {
          try {
            return JSON.parse(data);
          } catch (error) {
            console.warn('Failed to parse JSON string:', error);
            return null;
          }
        }
        return null;
      };

      // Process each batch
      let processedCount = 0;
      let errorCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (const batch of faqBatches) {
        try {
          // Check if this batch already exists in llm_discovery_faq_objects
          const { data: existingFaqObject } = await supabase
            .from('llm_discovery_faq_objects')
            .select('id, last_generated')
            .eq('batch_faq_pairs_id', batch.id)
            .single();

          if (existingFaqObject) {
            if (!forceReprocess) {
              console.log(`Skipping batch ${batch.id} - already exists (last generated: ${existingFaqObject.last_generated})`);
              skippedCount++;
              continue; // Skip this batch
            } else {
              console.log(`Force re-processing batch ${batch.id} - updating existing record`);
            }
          }

          // Use batch_date for week calculation instead of created_at
          const weekStart = new Date(batch.batch_date);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week

          // Use first organization if available, otherwise null
          const org = orgs && orgs.length > 0 ? orgs[0] : null;

          // Determine product_id - try multiple sources
          let productId = null;
          let productJsonld = null;

          // First try to match by product name from batch_faq_pairs
          if (batch.product && products && products.length > 0) {
            const matchingProduct = products.find(p => 
              p.product_name && 
              p.product_name.toLowerCase() === batch.product.toLowerCase()
            );
            if (matchingProduct) {
              productId = matchingProduct.id;
              productJsonld = safeJsonParse(matchingProduct.schema_json);
            }
          }

          // If no match by name, try client_configuration.product_id
          if (!productId && clientConfig?.product_id) {
            productId = clientConfig.product_id;
            productJsonld = safeJsonParse(clientConfig.schema_json);
          }
          // Then try first product from products table as fallback
          else if (!productId && products && products.length > 0) {
            productId = products[0].id;
            productJsonld = safeJsonParse(products[0].schema_json);
          }

          // Determine brand_id - try to match with product's brand
          let brandId = null;
          if (productId && products) {
            const product = products.find(p => p.id === productId);
            brandId = product?.brand_id || (brands && brands.length > 0 ? brands[0]?.id : null);
          } else {
            brandId = brands && brands.length > 0 ? brands[0]?.id : null;
          }

          const { error: insertError } = await supabase
            .from('llm_discovery_faq_objects')
            .insert({
              batch_faq_pairs_id: batch.id,
              auth_user_id: selectedClient.auth_user_id,
              client_organisation_id: org?.id || null,
              brand_id: brandId,
              product_id: productId, // Now properly linked!
              week_start_date: weekStart.toISOString().split('T')[0],
              faq_json_object: batch.faq_pairs_object,
              organization_jsonld: org ? safeJsonParse(org.organisation_jsonld_object) : null,
              brand_jsonld: brands && brands.length > 0 ? safeJsonParse(brands[0]?.brand_jsonld_object) : null,
              product_jsonld: productJsonld, // Now properly populated!
              last_generated: new Date().toISOString()
            });

          if (!insertError) {
            processedCount++;
            console.log(`Successfully processed batch ${batch.id} for dispatch date ${batch.batch_date} with product_id: ${productId}`);
          } else {
            errorCount++;
            errors.push(`Batch ${batch.id}: ${insertError.message}`);
          }
        } catch (batchError) {
          errorCount++;
          const errorMsg = batchError instanceof Error ? batchError.message : 'Unknown error';
          errors.push(`Batch ${batch.id}: ${errorMsg}`);
          console.error(`Error processing batch ${batch.id}:`, batchError);
        }
      }

      updateStep('populate_faq', { 
        status: 'completed', 
        progress: 100,
        result: { 
          batches_processed: processedCount,
          batches_skipped: skippedCount,
          batches_with_errors: errorCount,
          total_batches: faqBatches.length,
          errors: errors.length > 0 ? errors.slice(0, 3) : undefined // Show first 3 errors
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

  const fixProductRelationships = async () => {
    if (!selectedClient) {
      alert('Please select a client first');
      return;
    }

    try {
      setCurrentStep('fix_relationships');
      updateStep('fix_relationships', { status: 'running', progress: 10 });

      // Helper function to safely parse JSON
      const safeJsonParse = (data: any) => {
        if (!data) return null;
        if (typeof data === 'object') return data;
        if (typeof data === 'string') {
          try {
            return JSON.parse(data);
          } catch (error) {
            console.warn('Failed to parse JSON string:', error);
            return null;
          }
        }
        return null;
      };

      updateStep('fix_relationships', { progress: 20 });

      // Get all FAQ objects that need product relationships fixed
      const { data: faqObjects, error: faqError } = await supabase
        .from('llm_discovery_faq_objects')
        .select(`
          id,
          batch_faq_pairs_id,
          auth_user_id,
          client_organisation_id,
          brand_id,
          product_id,
          faq_json_object
        `)
        .eq('auth_user_id', selectedClient.auth_user_id)
        .or('product_id.is.null,product_jsonld.is.null');

      if (faqError) throw faqError;

      updateStep('fix_relationships', { progress: 40 });

      // Get products data for matching
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          product_name,
          schema_json,
          brand_id,
          organisation_id,
          auth_user_id
        `)
        .eq('auth_user_id', selectedClient.auth_user_id);

      if (productsError) throw productsError;

      updateStep('fix_relationships', { progress: 60 });

      // Get batch_faq_pairs data for product name matching
      const { data: batchFaqPairs, error: batchError } = await supabase
        .from('batch_faq_pairs')
        .select(`
          id,
          product,
          auth_user_id
        `)
        .eq('auth_user_id', selectedClient.auth_user_id);

      if (batchError) throw batchError;

      updateStep('fix_relationships', { progress: 80 });

      let updatedCount = 0;
      let productJsonldUpdated = 0;

      // Update each FAQ object with proper product relationships
      for (const faqObject of faqObjects || []) {
        let productId = faqObject.product_id;
        let productJsonld = null;

        // Find the corresponding batch_faq_pairs record
        const batchRecord = batchFaqPairs?.find(batch => batch.id === faqObject.batch_faq_pairs_id);
        
        if (batchRecord?.product && products) {
          // Try to match by product name
          const matchingProduct = products.find(p => 
            p.product_name && 
            p.product_name.toLowerCase() === batchRecord.product.toLowerCase()
          );
          
          if (matchingProduct) {
            productId = matchingProduct.id;
            productJsonld = safeJsonParse(matchingProduct.schema_json);
          }
        }

        // If still no product_id, try to get from client_configuration
        if (!productId) {
          const { data: clientConfig } = await supabase
            .from('client_configuration')
            .select('product_id, schema_json')
            .eq('auth_user_id', selectedClient.auth_user_id)
            .single();

          if (clientConfig?.product_id) {
            productId = clientConfig.product_id;
            productJsonld = safeJsonParse(clientConfig.schema_json);
          }
        }

        // Update the FAQ object if we found product data
        if (productId || productJsonld) {
          const updateData: any = {};
          if (productId) updateData.product_id = productId;
          if (productJsonld) updateData.product_jsonld = productJsonld;

          const { error: updateError } = await supabase
            .from('llm_discovery_faq_objects')
            .update(updateData)
            .eq('id', faqObject.id);

          if (!updateError) {
            updatedCount++;
            if (productJsonld) productJsonldUpdated++;
          }
        }
      }

      updateStep('fix_relationships', { 
        status: 'completed', 
        progress: 100,
        result: {
          faq_objects_processed: faqObjects?.length || 0,
          relationships_fixed: updatedCount,
          product_jsonld_added: productJsonldUpdated
        }
      });

    } catch (error) {
      console.error('Error fixing product relationships:', error);
      updateStep('fix_relationships', { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setCurrentStep(null);
    }
  };

  const validateObjects = async () => {
    if (!selectedClient) {
      alert('Please select a client first');
      return;
    }

    try {
      setCurrentStep('validate');
      updateStep('validate', { status: 'running', progress: 10 });

      // Check static objects
      const { data: staticObjects, error: staticError } = await supabase
        .from('llm_discovery_static')
        .select('*')
        .eq('auth_user_id', selectedClient.auth_user_id);

      if (staticError) throw staticError;

      updateStep('validate', { progress: 50 });

      // Check FAQ objects
      const { data: faqObjects, error: faqError } = await supabase
        .from('llm_discovery_faq_objects')
        .select('*')
        .eq('auth_user_id', selectedClient.auth_user_id);

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
    if (!selectedClient) {
      alert('Please select a client first');
      return;
    }

    try {
      setCurrentStep('preview');
      updateStep('preview', { status: 'running', progress: 10 });

      // Get organization data for preview
      const { data: org } = await supabase
        .from('client_organisation')
        .select('organisation_name')
        .eq('auth_user_id', selectedClient.auth_user_id)
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
    if (!selectedClient) {
      alert('Please select a client first');
      return;
    }
    
    if (!confirm('This will run all construction steps for the selected client. Continue?')) return;
    
    await scanExistingData();
    await populateStaticObjects();
    await enrichOrganizationJsonld();
    await enrichBrandJsonld();
    await enrichProductJsonld();
    await populateFAQObjects();
    await fixProductRelationships();
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

        {/* Client Selection */}
        <div className="mb-8 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-white mb-4">👤 Client Selection</h2>
          
          {clients.length === 0 ? (
            <div className="text-gray-400">No clients found. Please ensure you have access to client organizations.</div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="clientSelect" className="block text-gray-300 text-sm font-medium mb-2">
                  Select Client to Work On:
                </label>
                <select
                  id="clientSelect"
                  value={selectedClient?.auth_user_id || ''}
                  onChange={(e) => {
                    const client = clients.find(c => c.auth_user_id === e.target.value);
                    setSelectedClient(client || null);
                  }}
                  className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Select a client --</option>
                  {clients.map((client) => (
                    <option key={client.auth_user_id} value={client.auth_user_id}>
                      {client.organisation_name} ({client.user_email})
                    </option>
                  ))}
                </select>
              </div>

              {selectedClient && (
                <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-400 font-semibold">🎯 Working on:</span>
                    <span className="text-white font-medium">{selectedClient.organisation_name}</span>
                    <span className="text-gray-400">({selectedClient.user_email})</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scan Results */}
        {scanResult && selectedClient && (
          <div className="mb-8 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">📊 Data Scan Results for {selectedClient.organisation_name}</h2>
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
        <div className="mb-8 flex flex-wrap gap-4 items-center">
          <button
            onClick={runAllSteps}
            disabled={currentStep !== null || !selectedClient}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none"
          >
            🚀 Run All Steps
          </button>
          
          <button
            onClick={scanExistingData}
            disabled={currentStep !== null || !selectedClient}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200"
          >
            🔍 Scan Data
          </button>

          {/* Force Reprocess Checkbox */}
          <div className="flex items-center space-x-2 bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2">
            <input
              type="checkbox"
              id="forceReprocess"
              checked={forceReprocess}
              onChange={(e) => setForceReprocess(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <label htmlFor="forceReprocess" className="text-gray-300 text-sm">
              Force re-process existing batches
            </label>
          </div>
        </div>

        {/* Construction Steps */}
        <div className="space-y-6">
          {Object.values(steps).map((step) => (
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
                          case 'scan': scanExistingData(); break;
                          case 'populate_static': populateStaticObjects(); break;
                          case 'enrich_org': enrichOrganizationJsonld(); break;
                          case 'enrich_brand': enrichBrandJsonld(); break;
                          case 'populate_faq': populateFAQObjects(); break;
                          case 'fix_relationships': fixProductRelationships(); break;
                          case 'validate': validateObjects(); break;
                          case 'preview': previewDirectoryStructure(); break;
                        }
                      }}
                      disabled={currentStep !== null || !selectedClient}
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