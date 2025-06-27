"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Product {
  id: string;
  auth_user_id: string;
  user_email: string;
  organisation: string;
  product_name: string;
  description: string;
  keywords: string;
  url: string;
  category: string;
  schema_json: any;
  brand_id?: string;
  inserted_at?: string;
  ai_response?: any;
}

interface Brand {
  id: string;
  brand_name: string;
  organisation_name: string;
  auth_user_id: string;
}

interface AIFormData {
  industry: string;
  targetAudience: string;
  valueProposition: string;
  mainFeatures: string;
  competitors: string;
}

interface SubscriptionInfo {
  package_tier: string;
  status: string;
}

export default function ClientProducts() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [aiFormData, setAiFormData] = useState<AIFormData>({
    industry: '',
    targetAudience: '',
    valueProposition: '',
    mainFeatures: '',
    competitors: ''
  });
  const [pendingAnalysis, setPendingAnalysis] = useState<any>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);

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

      // Fetch all products for this user
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('auth_user_id', user.id)
        .order('inserted_at', { ascending: false });

      if (productsError) {
        setError('Failed to load products.');
      } else {
        setProducts(productsData || []);
      }

      // Fetch all brands for this user
      const { data: brandsData } = await supabase
        .from('brands')
        .select('*')
        .eq('auth_user_id', user.id);
      setBrands(brandsData || []);

      // Fetch subscription info
      const { data: subscriptionData } = await supabase
        .from('user_monthly_schedule')
        .select('package_tier, subscription_status')
        .eq('user_id', user.id)
        .single();

      if (subscriptionData) {
        setSubscription({
          package_tier: subscriptionData.package_tier,
          status: subscriptionData.subscription_status
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
    const limits = {
      pack1: { name: 'Starter', limit: 5 },
      pack2: { name: 'Growth', limit: 10 },
      pack3: { name: 'Professional', limit: 15 },
      pack4: { name: 'Enterprise', limit: 20 }
    };
    return limits[packageTier as keyof typeof limits] || { name: 'Unknown', limit: 0 };
  };

  const getPackageIcon = (packageTier: string) => {
    const icons = {
      pack1: '🚀',
      pack2: '📈',
      pack3: '💼',
      pack4: '🏢'
    };
    return icons[packageTier as keyof typeof icons] || '📦';
  };

  const canCreateProduct = () => {
    if (!subscription) return false;
    const limits = getPackageLimits(subscription.package_tier);
    return products.length < limits.limit;
  };

  const hasValidAIResponse = (product: Product) => {
    if (!product.ai_response) return false;
    try {
      const parsed = typeof product.ai_response === 'string' 
        ? JSON.parse(product.ai_response) 
        : product.ai_response;
      return parsed && (parsed.analysis || parsed.industry || parsed.targetAudience);
    } catch {
      return false;
    }
  };

  const closeAIPanel = () => {
    setAiResponse(null);
    setAiFormData({
      industry: '',
      targetAudience: '',
      valueProposition: '',
      mainFeatures: '',
      competitors: ''
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'brand_id') {
      const selectedBrand = brands.find(b => b.id === value);
      setFormData(prev => ({
        ...prev,
        brand_id: value,
        organisation: selectedBrand ? selectedBrand.organisation_name : prev.organisation,
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAIFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setAiFormData(prev => ({ ...prev, [name]: value }));
  };

  const askAI = async () => {
    if (!formData.url) {
      setError('Please enter a product URL first.');
      return;
    }

    setAiLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('User not authenticated.');
        return;
      }

      const requestData = {
        query: `Analyze this product: ${formData.url}`,
        product_name: formData.product_name || 'Unknown Product'
      };

      console.log('Sending to Perplexity:', requestData);

      const response = await fetch('https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/perplexity_product_search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestData)
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: Failed to analyze product`;
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
          mainFeatures: '',
          competitors: ''
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
            } else if (trimmedLine.startsWith('main_features:')) {
              parsedFormData.mainFeatures = trimmedLine.replace('main_features:', '').trim();
            } else if (trimmedLine.startsWith('competitors:')) {
              parsedFormData.competitors = trimmedLine.replace('competitors:', '').trim();
            }
          });
        }
        
        console.log('Setting form data:', parsedFormData);
        setAiFormData(parsedFormData);
        
        setSuccess('✅ AI analysis completed successfully! Review and save the results below.');
        
        // Save the analysis as JSON string to the products table if we have a product ID
        if (editingProduct?.id) {
          const { error: saveError } = await supabase
            .from('products')
            .update({
              ai_response: JSON.stringify(result.data)
            })
            .eq('id', editingProduct.id);
          
          if (saveError) {
            console.error('Failed to save analysis to database:', saveError);
            // Don't throw error here as the analysis was successful, just log it
          } else {
            console.log('Analysis saved to database successfully');
          }
        } else {
          // Store pending analysis for new products
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated.');
        return;
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
        user_email: user.email,
        organisation: formData.organisation || '',
        organisation_id: org.id,
        brand_id: formData.brand_id,
        product_name: formData.product_name || '',
        description: formData.description || '',
        keywords: formData.keywords || '',
        url: formData.url || '',
        category: formData.category || ''
      };

      // If we have AI form data, convert it to JSON and include it
      if (aiFormData.industry || aiFormData.targetAudience || aiFormData.valueProposition || aiFormData.mainFeatures || aiFormData.competitors) {
        const aiData = {
          industry: aiFormData.industry,
          targetAudience: aiFormData.targetAudience,
          valueProposition: aiFormData.valueProposition,
          mainFeatures: aiFormData.mainFeatures,
          competitors: aiFormData.competitors
        };
        saveData.ai_response = JSON.stringify(aiData);
      }

      let data, error;

      if (editingProduct) {
        // Update existing product
        const { data: updateData, error: updateError } = await supabase
          .from('products')
          .update(saveData)
          .eq('id', editingProduct.id)
          .select()
          .single();
        
        data = updateData;
        error = updateError;
      } else {
        // Insert new product
        const { data: insertData, error: insertError } = await supabase
          .from('products')
          .insert(saveData)
          .select()
          .single();
        
        data = insertData;
        error = insertError;
      }

      if (error) throw error;
      
      // If this was a new product and we have pending analysis, save it
      if (!editingProduct && pendingAnalysis && data) {
        const { error: analysisError } = await supabase
          .from('products')
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
      setSuccess('Product saved successfully!');
      
      // Clear pending analysis
      setPendingAnalysis(null);
      
      // Refresh data
      await loadData();
      setShowForm(false);
      setEditingProduct(null);
      setFormData({});
      setAiFormData({
        industry: '',
        targetAudience: '',
        valueProposition: '',
        mainFeatures: '',
        competitors: ''
      });
      setAiResponse(null);
    } catch (err) {
      console.error('Error saving product:', err);
      setError('Error saving product.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData(product);
    
    // Parse AI response if it exists
    if (product.ai_response) {
      try {
        const parsedResponse = typeof product.ai_response === 'string' 
          ? JSON.parse(product.ai_response) 
          : product.ai_response;
        
        if (parsedResponse.analysis) {
          // Parse the simple text format
          const lines = parsedResponse.analysis.trim().split('\n');
          const parsedFormData = {
            industry: '',
            targetAudience: '',
            valueProposition: '',
            mainFeatures: '',
            competitors: ''
          };
          
          lines.forEach((line: string) => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('industry:')) {
              parsedFormData.industry = trimmedLine.replace('industry:', '').trim();
            } else if (trimmedLine.startsWith('target_audience:')) {
              parsedFormData.targetAudience = trimmedLine.replace('target_audience:', '').trim();
            } else if (trimmedLine.startsWith('value_proposition:')) {
              parsedFormData.valueProposition = trimmedLine.replace('value_proposition:', '').trim();
            } else if (trimmedLine.startsWith('main_features:')) {
              parsedFormData.mainFeatures = trimmedLine.replace('main_features:', '').trim();
            } else if (trimmedLine.startsWith('competitors:')) {
              parsedFormData.competitors = trimmedLine.replace('competitors:', '').trim();
            }
          });
          
          setAiFormData(parsedFormData);
          setAiResponse(parsedResponse);
        } else {
          // Handle old JSON format
          setAiFormData({
            industry: parsedResponse.industry || '',
            targetAudience: parsedResponse.targetAudience || '',
            valueProposition: parsedResponse.valueProposition || '',
            mainFeatures: parsedResponse.mainFeatures || '',
            competitors: parsedResponse.competitors || ''
          });
          setAiResponse(parsedResponse);
        }
      } catch (parseError) {
        // If parsing fails, treat as plain text
        console.log('AI response is plain text, not JSON');
        setAiFormData({
          industry: '',
          targetAudience: '',
          valueProposition: '',
          mainFeatures: '',
          competitors: ''
        });
        setAiResponse(null);
      }
    } else {
      setAiFormData({
        industry: '',
        targetAudience: '',
        valueProposition: '',
        mainFeatures: '',
        competitors: ''
      });
      setAiResponse(null);
    }
    
    setShowForm(true);
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;
      await loadData();
    } catch (err) {
      console.error('Error deleting product:', err);
      setError('Error deleting product.');
    }
  };

  const handleNewProduct = () => {
    setEditingProduct(null);
    setFormData({});
    setAiFormData({
      industry: '',
      targetAudience: '',
      valueProposition: '',
      mainFeatures: '',
      competitors: ''
    });
    setAiResponse(null);
    setPendingAnalysis(null);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingProduct(null);
    setFormData({});
    setAiFormData({
      industry: '',
      targetAudience: '',
      valueProposition: '',
      mainFeatures: '',
      competitors: ''
    });
    setAiResponse(null);
    setPendingAnalysis(null);
  };

  const getProductsByBrand = () => {
    const grouped: { [key: string]: { brand: Brand; products: Product[] } } = {};
    
    products.forEach(product => {
      const brand = brands.find(b => b.id === product.brand_id);
      if (brand) {
        if (!grouped[brand.id]) {
          grouped[brand.id] = { brand, products: [] };
        }
        grouped[brand.id].products.push(product);
      }
    });
    
    return grouped;
  };

  const productsByBrand = getProductsByBrand();
  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.product_name && p.product_name.trim() !== '').length;

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
          <h1 className="text-4xl font-bold text-white mb-2">Product Management</h1>
          <p className="text-gray-400">Manage your products and their configurations</p>
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
                    {products.length} / {getPackageLimits(subscription.package_tier).limit === Infinity ? '∞' : getPackageLimits(subscription.package_tier).limit} products created
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
            <p className="text-green-400">✅ Product saved successfully!</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-6 flex justify-between items-center">
          <button
            onClick={handleNewProduct}
            disabled={!canCreateProduct()}
            className={`px-4 py-2 rounded-lg transition-colors ${
              canCreateProduct() 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {canCreateProduct() ? '+ Add New Product' : 'Product Limit Reached'}
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Product Form */}
        {showForm && (
          <div className="mb-8 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-6">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-300 mb-2 font-medium">Brand</label>
                  <select
                    name="brand_id"
                    className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    value={formData.brand_id || ''}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Brand</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.brand_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 mb-2 font-medium">Product Name</label>
                  <input 
                    name="product_name" 
                    className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
                    value={formData.product_name || ''} 
                    onChange={handleChange} 
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2 font-medium">Category</label>
                  <input 
                    name="category" 
                    className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
                    value={formData.category || ''} 
                    onChange={handleChange} 
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-300 mb-2 font-medium">Description</label>
                  <textarea 
                    name="description" 
                    className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
                    value={formData.description || ''} 
                    onChange={handleChange} 
                    rows={3} 
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2 font-medium">Keywords</label>
                  <input 
                    name="keywords" 
                    className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
                    value={formData.keywords || ''} 
                    onChange={handleChange} 
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2 font-medium">URL</label>
                  <input 
                    name="url" 
                    className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
                    value={formData.url || ''} 
                    onChange={handleChange} 
                  />
                </div>
              </div>

              {/* AI Analysis Fields - Always Visible */}
              <div className="border-t border-gray-700/50 pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">AI Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 mb-2 font-medium">Industry</label>
                    <input
                      name="industry"
                      value={aiFormData.industry}
                      onChange={handleAIFormChange}
                      className="w-full p-3 rounded-lg bg-gray-700/30 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      placeholder="e.g., Technology, Automotive, SaaS"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-2 font-medium">Target Audience</label>
                    <input
                      name="targetAudience"
                      value={aiFormData.targetAudience}
                      onChange={handleAIFormChange}
                      className="w-full p-3 rounded-lg bg-gray-700/30 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      placeholder="e.g., Small businesses; Enterprise clients"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-gray-300 mb-2 font-medium">Value Proposition</label>
                    <textarea
                      name="valueProposition"
                      value={aiFormData.valueProposition}
                      onChange={handleAIFormChange}
                      className="w-full p-3 rounded-lg bg-gray-700/30 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      rows={2}
                      placeholder="What problem does this product solve?"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-gray-300 mb-2 font-medium">Main Features</label>
                    <textarea
                      name="mainFeatures"
                      value={aiFormData.mainFeatures}
                      onChange={handleAIFormChange}
                      className="w-full p-3 rounded-lg bg-gray-700/30 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      rows={2}
                      placeholder="Key features separated by semicolons"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-gray-300 mb-2 font-medium">Competitors</label>
                    <textarea
                      name="competitors"
                      value={aiFormData.competitors}
                      onChange={handleAIFormChange}
                      className="w-full p-3 rounded-lg bg-gray-700/30 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      rows={2}
                      placeholder="Direct competitors separated by semicolons"
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : (editingProduct ? 'Update Product' : 'Create Product')}
                </button>
                <button
                  type="button"
                  onClick={askAI}
                  disabled={aiLoading || !formData.url}
                  className={`px-6 py-2 rounded-lg transition-colors ${
                    aiLoading || !formData.url
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
                  <h3 className="text-lg font-semibold text-white">🤖 Product Analysis</h3>
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
                      onChange={(e) => setAiFormData(prev => ({ ...prev, industry: e.target.value }))}
                      className="w-full p-3 rounded-lg bg-gray-700/30 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      placeholder="e.g., Technology, Automotive, SaaS"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-2 font-medium">Target Audience</label>
                    <input
                      type="text"
                      value={aiFormData.targetAudience}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, targetAudience: e.target.value }))}
                      className="w-full p-3 rounded-lg bg-gray-700/30 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      placeholder="e.g., Small businesses; Enterprise clients"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-2 font-medium">Value Proposition</label>
                    <textarea
                      value={aiFormData.valueProposition}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, valueProposition: e.target.value }))}
                      className="w-full p-3 rounded-lg bg-gray-700/30 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      rows={3}
                      placeholder="What problem does this product solve?"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-2 font-medium">Main Features</label>
                    <textarea
                      value={aiFormData.mainFeatures}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, mainFeatures: e.target.value }))}
                      className="w-full p-3 rounded-lg bg-gray-700/30 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      rows={3}
                      placeholder="Key features separated by semicolons"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-2 font-medium">Competitors</label>
                    <textarea
                      value={aiFormData.competitors}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, competitors: e.target.value }))}
                      className="w-full p-3 rounded-lg bg-gray-700/30 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      rows={3}
                      placeholder="Direct competitors separated by semicolons"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={handleSubmit}
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

        {/* Products Cards */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Your Products</h2>
          </div>
          
          {products.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-gray-400 mb-4">No products found. Create your first product to get started.</p>
              <button
                onClick={handleNewProduct}
                disabled={!canCreateProduct()}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  canCreateProduct() 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {canCreateProduct() ? 'Create Your First Product' : 'Product Limit Reached'}
              </button>
            </div>
          ) : (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.values(productsByBrand).map(({ brand, products: brandProducts }) => (
                  <div key={brand.id} className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-2xl font-bold text-white mb-2">{brand.brand_name}</h3>
                        <p className="text-gray-400">{brand.organisation_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-400">{brandProducts.length}</p>
                        <p className="text-gray-400 text-sm">Products</p>
                      </div>
                    </div>

                    {brandProducts.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        <p className="text-gray-400 mb-4">No products for this brand yet</p>
                        <button
                          onClick={() => {
                            setFormData({ brand_id: brand.id, organisation: brand.organisation_name });
                            setShowForm(true);
                          }}
                          className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-2 rounded-lg transition-colors"
                        >
                          Add Product
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {brandProducts.map((product) => (
                          <div key={product.id} className="bg-gray-800/30 border border-gray-600/30 rounded-xl p-4 hover:border-gray-500/50 transition-all duration-200">
                            <div className="flex items-start justify-between mb-3">
                              <h4 className="text-lg font-semibold text-white truncate">{product.product_name || 'Unnamed Product'}</h4>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEdit(product)}
                                  className="text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDelete(product.id)}
                                  className="text-red-400 hover:text-red-300 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div>
                                <p className="text-gray-400 text-sm">Category</p>
                                <p className="text-white text-sm font-medium">{product.category || 'No category'}</p>
                              </div>
                              
                              <div>
                                <p className="text-gray-400 text-sm">URL</p>
                                {product.url ? (
                                  <a 
                                    href={product.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 text-sm truncate block"
                                  >
                                    {product.url}
                                  </a>
                                ) : (
                                  <span className="text-gray-500 text-sm">No URL</span>
                                )}
                              </div>
                              
                              <div>
                                <p className="text-gray-400 text-sm">Created</p>
                                <p className="text-white text-sm">
                                  {product.inserted_at ? new Date(product.inserted_at).toLocaleDateString() : 'N/A'}
                                </p>
                              </div>

                              {/* Analysis Section */}
                              <div className="pt-2 border-t border-gray-600/30">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-gray-400 text-sm">AI Analysis</p>
                                    {hasValidAIResponse(product) && (
                                      <span className="text-green-400 text-xs">✅ Available</span>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center justify-between">
                                    <p className="text-gray-400 text-sm">Schema.org</p>
                                    {product.schema_json ? (
                                      <span className="text-blue-400 text-xs">✅ Generated</span>
                                    ) : hasValidAIResponse(product) ? (
                                      <span className="text-yellow-400 text-xs">⚠️ Ready to generate</span>
                                    ) : (
                                      <span className="text-gray-500 text-xs">Not available</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 