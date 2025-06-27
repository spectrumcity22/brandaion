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
  logo_url?: string;
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

interface AIFormData {
  industry: string;
  targetAudience: string;
  valueProposition: string;
  mainServices: string;
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
  const [aiFormData, setAiFormData] = useState<AIFormData>({
    industry: '',
    targetAudience: '',
    valueProposition: '',
    mainServices: ''
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

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

      // Load subscription info - ignore status field, just check for any paid invoices
      const { data: subscriptionData } = await supabase
        .from('invoices')
        .select('package_tier')
        .eq('auth_user_id', user.id)
        .order('inserted_at', { ascending: false })
        .limit(1);

      if (subscriptionData?.[0]) {
        setSubscription({
          package_tier: subscriptionData[0].package_tier,
          status: 'active' // Assume active if they have any invoice
        });
      } else {
        setSubscription({
          package_tier: 'startup',
          status: 'inactive'
        });
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

  const startEditingAIResponse = () => {
    setAiLoading(true);
    setAiResponse(null);
  };

  const cancelEditingAIResponse = () => {
    setAiResponse(null);
    setAiFormData({
      industry: '',
      targetAudience: '',
      valueProposition: '',
      mainServices: ''
    });
  };

  const closeAIPanel = () => {
    setAiResponse(null);
    setAiFormData({
      industry: '',
      targetAudience: '',
      valueProposition: '',
      mainServices: ''
    });
    setSuccess(''); // Clear success message when closing panel
  };

  const generateSchemaOrg = (brand: Brand, aiData: any) => {
    const brandSummary = aiData?.brand_summary;
    
    return {
      "@context": "https://schema.org",
      "@type": "Brand",
      "name": brand.brand_name,
      "url": brand.brand_url,
      "description": brandSummary?.value_proposition || `AI-powered brand optimization for ${brand.brand_name}`,
      "parentOrganization": {
        "@type": "Organization",
        "name": brand.organisation_name
      },
      "industry": brandSummary?.industry || "Technology",
      "targetAudience": brandSummary?.target_audience || "Businesses and brands",
      "mainEntity": {
        "@type": "Service",
        "name": brand.brand_name,
        "description": brandSummary?.value_proposition || `AI-powered brand optimization services`,
        "serviceType": brandSummary?.main_services?.[0] || "Brand Optimization",
        "provider": {
          "@type": "Organization",
          "name": brand.organisation_name
        }
      }
    };
  };

  const approveAndGenerateSchema = async () => {
    console.log('approveAndGenerateSchema called');
    console.log('editingBrand:', editingBrand);
    console.log('aiFormData:', aiFormData);
    
    if (!editingBrand?.id) {
      console.log('No editingBrand.id found');
      return;
    }

    try {
      console.log('Saving AI response to trigger schema generation...');

      // Save the AI response - this will trigger the database trigger to regenerate schema.org
      const { error } = await supabase
        .from('brands')
        .update({
          ai_response: JSON.stringify(aiFormData)
        })
        .eq('id', editingBrand.id);

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      console.log('Successfully saved AI response and triggered schema generation');
      setSuccess('✅ Brand analysis saved and schema.org generated!');
      
      // Close the AI panel
      closeAIPanel();
      
      // Refresh the brand data
      await loadData();
    } catch (err) {
      console.error('Error saving brand analysis:', err);
      setError('Failed to save brand analysis.');
    }
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

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Logo file size must be less than 5MB');
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      
      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return null;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, logoFile);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      setError('Failed to upload logo');
      return null;
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

      // Upload logo if present
      let logoUrl = formData.logo_url || null;
      if (logoFile) {
        logoUrl = await uploadLogo();
        if (!logoUrl) {
          setSaving(false);
          return;
        }
      }

      // Fetch organisation_id for the user
      const { data: org, error: orgError } = await supabase
        .from('client_organisation')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
      if (orgError || !org) {
        setError('No organisation found for this user.');
        setSaving(false);
        return;
      }

      // Prepare the data to save
      const saveData: any = {
        auth_user_id: user.id,
        organisation_id: formData.organisation_id || org.id,
        brand_name: formData.brand_name || '',
        brand_url: formData.brand_url || '',
        logo_url: logoUrl
      };

      // If we have AI form data, convert it to JSON and include it
      if (aiFormData.industry || aiFormData.targetAudience || aiFormData.valueProposition || aiFormData.mainServices) {
        const aiData = {
          industry: aiFormData.industry,
          targetAudience: aiFormData.targetAudience,
          valueProposition: aiFormData.valueProposition,
          mainServices: aiFormData.mainServices
        };
        saveData.ai_response = JSON.stringify(aiData);
      }

      let data, error;

      if (editingBrand) {
        // Update existing brand
        const { data: updateData, error: updateError } = await supabase
          .from('brands')
          .update(saveData)
          .eq('id', editingBrand.id)
          .select()
          .single();
        
        data = updateData;
        error = updateError;
      } else {
        // Insert new brand
        const { data: insertData, error: insertError } = await supabase
          .from('brands')
          .insert(saveData)
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
            ai_response: JSON.stringify(pendingAnalysis)
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
      setSuccess('Brand saved successfully!');
      
      // Clear pending analysis and logo
      setPendingAnalysis(null);
      setLogoFile(null);
      setLogoPreview(null);
      
      // Refresh data
      await loadData();
      setShowForm(false);
      setEditingBrand(null);
      setFormData({});
      setAiFormData({
        industry: '',
        targetAudience: '',
        valueProposition: '',
        mainServices: ''
      });
      setAiResponse(null);
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
      try {
        // Try to parse as JSON first (for structured responses)
        const parsedResponse = JSON.parse(brand.ai_response);
        console.log('Loaded AI response:', parsedResponse);
        
        // Check if this is the new simple text format
        if (parsedResponse.analysis && typeof parsedResponse.analysis === 'string') {
          // Parse the simple text format: "industry: value\ntarget_audience: value\n..."
          const lines = parsedResponse.analysis.trim().split('\n');
          const parsedFormData = {
            industry: '',
            targetAudience: '',
            valueProposition: '',
            mainServices: ''
          };

          lines.forEach((line: string) => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('industry:')) {
              parsedFormData.industry = trimmedLine.replace('industry:', '').trim();
            } else if (trimmedLine.startsWith('target_audience:')) {
              parsedFormData.targetAudience = trimmedLine.replace('target_audience:', '').trim();
            } else if (trimmedLine.startsWith('value_proposition:')) {
              parsedFormData.valueProposition = trimmedLine.replace('value_proposition:', '').trim();
            } else if (trimmedLine.startsWith('main_services:')) {
              parsedFormData.mainServices = trimmedLine.replace('main_services:', '').trim();
            }
          });

          console.log('Parsed simple text format:', parsedFormData);
          setAiFormData(parsedFormData);
          setAiResponse(parsedResponse);
        } else {
          // Handle old JSON format
          let brandSummary = null;
          
          // Handle nested structure where data is in analysis field
          if (parsedResponse.analysis) {
            try {
              const analysisData = JSON.parse(parsedResponse.analysis);
              brandSummary = analysisData.brand_summary;
            } catch (parseError) {
              console.error('Failed to parse analysis JSON:', parseError);
            }
          }
          
          if (brandSummary) {
            setAiFormData({
              industry: brandSummary.industry || '',
              targetAudience: brandSummary.target_audience || '',
              valueProposition: brandSummary.value_proposition || '',
              mainServices: brandSummary.main_services?.join(', ') || ''
            });
            setAiResponse(parsedResponse); // Show the form
          } else {
            // Fallback to direct fields if no nested structure
            setAiFormData({
              industry: parsedResponse.industry || '',
              targetAudience: parsedResponse.targetAudience || '',
              valueProposition: parsedResponse.valueProposition || '',
              mainServices: parsedResponse.mainServices || ''
            });
            setAiResponse(parsedResponse);
          }
        }
      } catch (parseError) {
        // If parsing fails, treat as plain text
        console.log('AI response is plain text, not JSON');
        setAiFormData({
          industry: '',
          targetAudience: '',
          valueProposition: '',
          mainServices: ''
        });
        setAiResponse(null);
      }
    } else {
      setAiFormData({
        industry: '',
        targetAudience: '',
        valueProposition: '',
        mainServices: ''
      });
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
        // Store the structured response for display
        setAiResponse(result.data);
        
        console.log('AI Response data:', result.data);
        
        // Parse the simple text response from the analysis field
        let parsedFormData = {
          industry: '',
          targetAudience: '',
          valueProposition: '',
          mainServices: ''
        };

        if (result.data.analysis) {
          // Parse the simple text format: "industry: value\ntarget_audience: value\n..."
          const lines = result.data.analysis.trim().split('\n');
          lines.forEach((line: string) => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('industry:')) {
              parsedFormData.industry = trimmedLine.replace('industry:', '').trim();
            } else if (trimmedLine.startsWith('target_audience:')) {
              parsedFormData.targetAudience = trimmedLine.replace('target_audience:', '').trim();
            } else if (trimmedLine.startsWith('value_proposition:')) {
              parsedFormData.valueProposition = trimmedLine.replace('value_proposition:', '').trim();
            } else if (trimmedLine.startsWith('main_services:')) {
              parsedFormData.mainServices = trimmedLine.replace('main_services:', '').trim();
            }
          });
        }
        
        console.log('Setting form data:', parsedFormData);
        setAiFormData(parsedFormData);
        
        setSuccess('✅ AI analysis completed successfully! Review and save the results below.');
        
        // Save the analysis as JSON string to the brands table if we have a brand ID
        if (editingBrand?.id) {
          const { error: saveError } = await supabase
            .from('brands')
            .update({
              ai_response: JSON.stringify(result.data)
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

                <div className="md:col-span-2">
                  <label className="block text-gray-300 mb-2 font-medium">Brand Logo</label>
                  <div className="flex items-center space-x-4">
                    {(logoPreview || formData.logo_url) && (
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-700/50 border border-gray-600/50">
                        <img
                          src={logoPreview || formData.logo_url}
                          alt="Brand logo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Recommended size: 100x100px to 300x300px, max 5MB
                      </p>
                    </div>
                  </div>
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
                    '🤖 Complete with AI'
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">🤖 Brand Analysis</h3>
                  <button
                    onClick={closeAIPanel}
                    className="text-gray-400 hover:text-white text-sm"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-300 mb-2 font-medium">Industry</label>
                    <input
                      type="text"
                      value={aiFormData.industry}
                      onChange={(e) => setAiFormData((prev: AIFormData) => ({ ...prev, industry: e.target.value }))}
                      className="w-full p-3 rounded-lg bg-gray-700/30 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      placeholder="e.g., Technology, Healthcare, E-commerce"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-2 font-medium">Target Audience</label>
                    <input
                      type="text"
                      value={aiFormData.targetAudience}
                      onChange={(e) => setAiFormData((prev: AIFormData) => ({ ...prev, targetAudience: e.target.value }))}
                      className="w-full p-3 rounded-lg bg-gray-700/30 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      placeholder="e.g., Small businesses, Enterprise clients"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-2 font-medium">Value Proposition</label>
                    <textarea
                      value={aiFormData.valueProposition}
                      onChange={(e) => setAiFormData((prev: AIFormData) => ({ ...prev, valueProposition: e.target.value }))}
                      className="w-full p-3 rounded-lg bg-gray-700/30 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      rows={3}
                      placeholder="What unique value does your brand provide?"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-2 font-medium">Main Services</label>
                    <textarea
                      value={aiFormData.mainServices}
                      onChange={(e) => setAiFormData((prev: AIFormData) => ({ ...prev, mainServices: e.target.value }))}
                      className="w-full p-3 rounded-lg bg-gray-700/30 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      rows={3}
                      placeholder="List your main services, separated by commas"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={approveAndGenerateSchema}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                      💾 Save & Generate Schema
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
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {brand.logo_url && (
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700/50 border border-gray-600/50 flex-shrink-0">
                              <img
                                src={brand.logo_url}
                                alt={`${brand.brand_name} logo`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <h4 className="text-lg font-semibold text-white truncate">{brand.brand_name}</h4>
                        </div>
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
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-gray-400 text-sm">AI Analysis</p>
                              {hasValidAIResponse(brand) && (
                                <span className="text-green-400 text-xs">✅ Available</span>
                              )}
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <p className="text-gray-400 text-sm">Schema.org</p>
                              {brand.brand_jsonld_object ? (
                                <span className="text-blue-400 text-xs">✅ Generated</span>
                              ) : hasValidAIResponse(brand) ? (
                                <span className="text-yellow-400 text-xs">⚠️ Ready to generate</span>
                              ) : (
                                <span className="text-gray-500 text-xs">Not available</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Upgrade Cards to fill empty slots */}
                {(() => {
                  const currentBrandCount = brands.length;
                  const limits = subscription ? getPackageLimits(subscription.package_tier) : { limit: 0 };
                  const maxBrands = limits.limit === Infinity ? 999 : limits.limit;
                  const emptySlots = Math.max(0, 3 - (currentBrandCount % 3));
                  
                  if (currentBrandCount >= maxBrands && emptySlots > 0) {
                    return Array.from({ length: emptySlots }, (_, index) => (
                      <div key={`upgrade-${index}`} className="relative bg-gray-800/30 backdrop-blur-sm border border-gray-600/30 rounded-xl p-4 overflow-hidden">
                        {/* Blurred overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10 backdrop-blur-sm"></div>
                        
                        {/* Content */}
                        <div className="relative z-10 text-center py-6">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                          <h4 className="text-lg font-semibold text-white mb-2">Upgrade Your Plan</h4>
                          <p className="text-gray-400 text-sm mb-3">Unlock more brands and features</p>
                          <button
                            onClick={() => router.push('/packages')}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 text-sm"
                          >
                            View Plans
                          </button>
                        </div>
                      </div>
                    ));
                  }
                  return null;
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 