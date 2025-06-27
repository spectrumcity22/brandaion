"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Brand {
  id: string;
  auth_user_id: string;
  organisation_id: string;
  organisation_name: string;
  brand_name: string;
  brand_url: string;
  brand_jsonld_object: any;
  ai_response?: string;
  created_at?: string;
  updated_at?: string;
}

interface Organisation {
  id: string;
  organisation_name: string;
  auth_user_id: string;
}

interface SubscriptionInfo {
  package_tier: string;
  status: string;
}

interface BrandAnalysis {
  id: string;
  brand_id: string;
  analysis_status: string;
  url_analyzed: string;
  analysis_date: string;
  perplexity_status: string;
  perplexity_cost_usd?: number;
  perplexity_response_time_ms?: number;
  brand_identity?: any;
  content_summary?: any;
  technical_insights?: any;
  customer_insights?: any;
  competitive_positioning?: any;
  faq_generation_insights?: any;
}

export default function ClientBrandsForm() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState<Partial<Brand>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | boolean>(false);
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!user || authError) {
        router.push('/login');
        return;
      }

      // Fetch all brands for this user
      const { data: brandsData, error: brandsError } = await supabase
        .from('brands')
        .select('*')
        .eq('auth_user_id', user.id)
        .order('created_at', { ascending: false });

      if (brandsError) {
        setError('Failed to load brands.');
      } else {
        console.log('Loaded brands:', brandsData);
        setBrands(brandsData || []);
      }

      // Fetch organisations for this user
      const { data: orgsData, error: orgsError } = await supabase
        .from('client_organisation')
        .select('id, organisation_name, auth_user_id')
        .eq('auth_user_id', user.id);

      if (orgsError) {
        setError('Failed to load organisations.');
      } else {
        setOrganisations(orgsData || []);
      }

      // Load subscription info
      const { data: subscriptionData } = await supabase
        .from('invoices')
        .select('package_tier, status')
        .eq('auth_user_id', user.id)
        .order('inserted_at', { ascending: false })
        .limit(1);

      if (subscriptionData?.[0]) {
        setSubscription(subscriptionData[0]);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data.');
      setLoading(false);
    }
  };

  const getPackageLimits = (packageTier: string) => {
    switch (packageTier?.toLowerCase()) {
      case 'startup':
      case 'pack1':
        return { name: 'Startup', limit: 1 };
      case 'growth':
      case 'pack2':
        return { name: 'Growth', limit: 2 };
      case 'pro':
      case 'pack3':
        return { name: 'Pro', limit: 5 };
      case 'enterprise':
      case 'pack4':
        return { name: 'Enterprise', limit: Infinity };
      default:
        return { name: 'Startup', limit: 1 };
    }
  };

  const getPackageIcon = (packageTier: string) => {
    switch (packageTier?.toLowerCase()) {
      case 'startup':
      case 'pack1':
        return '🚀';
      case 'growth':
      case 'pack2':
        return '📈';
      case 'pro':
      case 'pack3':
        return '💎';
      case 'enterprise':
      case 'pack4':
        return '👑';
      default:
        return '📦';
    }
  };

  const canCreateBrand = () => {
    const packageInfo = getPackageLimits(subscription?.package_tier || 'startup');
    return brands.length < packageInfo.limit;
  };

  const hasValidAIResponse = (brand: Brand) => {
    return brand.ai_response && brand.ai_response.trim().length > 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'organisation_id') {
      const selectedOrg = organisations.find(o => o.id === value);
      setFormData(prev => ({
        ...prev,
        organisation_id: value,
        organisation_name: selectedOrg ? selectedOrg.organisation_name : prev.organisation_name,
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated.');
        return;
      }

      // Check package limits for new brands
      if (!editingBrand && !canCreateBrand()) {
        const packageInfo = getPackageLimits(subscription?.package_tier || 'startup');
        setError(`You have reached your brand limit for ${packageInfo.name} package. Please upgrade to create more brands.`);
        setSaving(false);
        return;
      }

      let data, error;

      if (editingBrand) {
        // Update existing brand
        const { data: updateData, error: updateError } = await supabase
          .from('brands')
          .update({
            auth_user_id: user.id,
            organisation_id: formData.organisation_id,
            organisation_name: formData.organisation_name || '',
            brand_name: formData.brand_name || '',
            brand_url: formData.brand_url || ''
          })
          .eq('id', editingBrand.id)
          .select()
          .single();
        
        data = updateData;
        error = updateError;
      } else {
        // Insert new brand
        const { data: insertData, error: insertError } = await supabase
          .from('brands')
          .insert({
            auth_user_id: user.id,
            organisation_id: formData.organisation_id,
            organisation_name: formData.organisation_name || '',
            brand_name: formData.brand_name || '',
            brand_url: formData.brand_url || ''
          })
          .select()
          .single();
        
        data = insertData;
        error = insertError;
      }

      if (error) throw error;
      
      // If this was a new brand and we have pending analysis, save it
      if (!editingBrand && pendingAnalysis && data) {
        const { error: analysisError } = await supabase
          .from('brands')
          .update({
            ai_response: pendingAnalysis.analysis
          })
          .eq('id', data.id);
        
        if (analysisError) {
          console.error('Failed to save pending analysis:', analysisError);
        } else {
          console.log('Pending analysis saved successfully');
        }
      }
      
      // Show success message
      setError(''); // Clear any previous errors
      setSuccess(true);
      
      // Clear pending analysis
      setPendingAnalysis(null);
      
      // Refresh data
      await loadData();
      setShowForm(false);
      setEditingBrand(null);
      setFormData({});
    } catch (err) {
      console.error('Error saving brand:', err);
      setError('Error saving brand.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setFormData(brand);
    
    // Load existing AI response if available
    if (brand.ai_response) {
      setAiResponse({
        analysis: brand.ai_response,
        brand_name: brand.brand_name,
        query: `Analyze this website: ${brand.brand_url}`
      });
    } else {
      setAiResponse(null);
    }
    
    setShowForm(true);
  };

  const handleDelete = async (brandId: string) => {
    if (!confirm('Are you sure you want to delete this brand?')) return;
    
    try {
      const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', brandId);

      if (error) throw error;
      await loadData();
    } catch (err) {
      console.error('Error deleting brand:', err);
      setError('Error deleting brand.');
    }
  };

  const handleNewBrand = () => {
    setEditingBrand(null);
    setFormData({});
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingBrand(null);
    setFormData({});
    setError('');
  };

  const askAI = async () => {
    if (!formData.brand_url) {
      setError('Brand URL is required for AI analysis.');
      return;
    }

    setAiLoading(true);
    setError('');
    setAiResponse(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('User not authenticated.');
        return;
      }

      // Try different request formats - let's test what works
      const requestData = {
        query: `Analyze this website: ${formData.brand_url}`,
        brand_name: formData.brand_name || 'Unknown Brand'
      };

      console.log('Sending to Perplexity:', requestData);

      const response = await fetch('https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/perplexity_brand_search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestData)
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: Failed to analyze brand`;
        try {
          const errorData = await response.json();
          console.error('API Error:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error('Could not parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('API Result:', result);
      
      if (result.success) {
        setAiResponse(result.data);
        setSuccess('✅ AI analysis completed successfully!');
        
        // Save the analysis to the brands table if we have a brand ID
        if (editingBrand?.id) {
          const { error: saveError } = await supabase
            .from('brands')
            .update({
              ai_response: result.data.analysis
            })
            .eq('id', editingBrand.id);
          
          if (saveError) {
            console.error('Failed to save analysis to database:', saveError);
            // Don't throw error here as the analysis was successful, just log it
          } else {
            console.log('Analysis saved to database successfully');
          }
        } else {
          // Store pending analysis for new brands
          setPendingAnalysis(result.data);
        }
      } else {
        throw new Error(result.error || 'Analysis failed');
      }
    } catch (err: any) {
      console.error('AI Analysis Error:', err);
      setError(`❌ AI Analysis failed: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Brand Management</h1>
          <p className="text-gray-400">Manage your brands and their configurations</p>
        </div>

        {/* Package Information Panel */}
        {subscription && (
          <div className="mb-8 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-3xl">{getPackageIcon(subscription.package_tier)}</div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {getPackageLimits(subscription.package_tier).name} Package
                  </h3>
                  <p className="text-gray-300">
                    {brands.length} / {getPackageLimits(subscription.package_tier).limit === Infinity ? '∞' : getPackageLimits(subscription.package_tier).limit} brands created
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Status</p>
                <p className={`font-semibold ${subscription.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
                  {subscription.status === 'active' ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-900/20 border border-green-500/50 rounded-lg">
            <p className="text-green-400">✅ Brand saved successfully!</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-6 flex justify-between items-center">
          <button
            onClick={handleNewBrand}
            disabled={!canCreateBrand()}
            className={`px-4 py-2 rounded-lg transition-colors ${
              canCreateBrand() 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {canCreateBrand() ? '+ Add New Brand' : 'Brand Limit Reached'}
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Brand Form */}
        {showForm && (
          <div className="mb-8 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-6">
              {editingBrand ? 'Edit Brand' : 'Add New Brand'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-300 mb-2 font-medium">Organisation</label>
                  <select
                    name="organisation_id"
                    value={formData.organisation_id || ''}
                    onChange={handleChange}
                    className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    required
                  >
                    <option value="">Select an organisation</option>
                    {organisations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.organisation_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 mb-2 font-medium">Brand Name</label>
                  <input
                    type="text"
                    name="brand_name"
                    value={formData.brand_name || ''}
                    onChange={handleChange}
                    className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder="Enter brand name"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-300 mb-2 font-medium">Brand URL</label>
                  <input
                    type="url"
                    name="brand_url"
                    value={formData.brand_url || ''}
                    onChange={handleChange}
                    className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder="https://yourbrand.com"
                  />
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : (editingBrand ? 'Update Brand' : 'Create Brand')}
                </button>
                <button
                  type="button"
                  onClick={askAI}
                  disabled={aiLoading || !formData.brand_url}
                  className={`px-6 py-2 rounded-lg transition-colors ${
                    aiLoading || !formData.brand_url
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {aiLoading ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Analyzing...
                    </div>
                  ) : (
                    '🤖 Ask AI'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>

            {/* AI Response Display */}
            {aiResponse && (
              <div className="mt-6 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">🤖 AI Analysis Results</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-md font-medium text-gray-300 mb-2">Analysis</h4>
                    <div className="bg-gray-700/30 rounded p-3">
                      <p className="text-white text-sm whitespace-pre-wrap">
                        {aiResponse.analysis || 'No analysis available'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Brand: {aiResponse.brand_name || 'N/A'}</span>
                    <span>Query: {aiResponse.query || 'N/A'}</span>
                  </div>
                  
                  <div className="mt-4">
                    <button
                      onClick={() => setAiResponse(null)}
                      className="text-gray-400 hover:text-white text-sm"
                    >
                      Clear Results
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Brands Cards */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Your Brands</h2>
          </div>
          
          {brands.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <p className="text-gray-400 mb-4">No brands found. Create your first brand to get started.</p>
              <button
                onClick={handleNewBrand}
                disabled={!canCreateBrand()}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  canCreateBrand() 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {canCreateBrand() ? 'Create Your First Brand' : 'Brand Limit Reached'}
              </button>
            </div>
          ) : (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {brands.map((brand) => {
                  return (
                    <div key={brand.id} className="bg-gray-800/30 border border-gray-600/30 rounded-xl p-4 hover:border-gray-500/50 transition-all duration-200">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="text-lg font-semibold text-white truncate">{brand.brand_name}</h4>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(brand)}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                            title="Edit Brand"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(brand.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            title="Delete Brand"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <p className="text-gray-400 text-sm">Organisation</p>
                          <p className="text-white text-sm font-medium">{brand.organisation_name}</p>
                        </div>
                        
                        <div>
                          <p className="text-gray-400 text-sm">URL</p>
                          {brand.brand_url ? (
                            <a 
                              href={brand.brand_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 text-sm truncate block"
                            >
                              {brand.brand_url}
                            </a>
                          ) : (
                            <span className="text-gray-500 text-sm">No URL</span>
                          )}
                        </div>
                        
                        <div>
                          <p className="text-gray-400 text-sm">Created</p>
                          <p className="text-white text-sm">
                            {brand.created_at ? new Date(brand.created_at).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>

                        {/* Analysis Section */}
                        <div className="pt-2 border-t border-gray-600/30">
                          <div className="flex items-center justify-between">
                            <p className="text-gray-400 text-sm">AI Analysis</p>
                            {hasValidAIResponse(brand) && (
                              <span className="text-green-400 text-xs">✅ Available</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 