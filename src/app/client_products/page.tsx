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
  market_name: string;
  product_name: string;
  description: string;
  keywords: string;
  url: string;
  category: string;
  schema_json: any;
  brand_id?: string;
  inserted_at?: string;
}

interface Brand {
  id: string;
  brand_name: string;
  organisation_name: string;
  auth_user_id: string;
}

interface MarketOption {
  id: string;
  name: string;
}

export default function ClientProducts() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markets, setMarkets] = useState<MarketOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [saving, setSaving] = useState(false);

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

      // Fetch markets for dropdown
      const { data: marketData } = await supabase
        .from('markets')
        .select('id, name');
      if (marketData) setMarkets(marketData);

      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data.');
      setLoading(false);
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated.');
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .upsert({
          ...formData,
          auth_user_id: user.id,
          user_email: user.email,
          organisation: formData.organisation || '',
          brand_id: formData.brand_id,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Refresh data
      await loadData();
      setShowForm(false);
      setEditingProduct(null);
      setFormData({});
      setError('');
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
    setShowForm(true);
  };

  const getProductsByBrand = () => {
    const grouped: { [key: string]: { brand: Brand; products: Product[] } } = {};
    
    brands.forEach(brand => {
      grouped[brand.id] = {
        brand,
        products: products.filter(p => p.brand_id === brand.id)
      };
    });

    return grouped;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading products...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-red-400 mb-2">Error</h2>
            <p className="text-gray-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const productsByBrand = getProductsByBrand();
  const totalProducts = products.length;
  const totalBrands = brands.length;
  const activeProducts = products.filter(p => p.product_name && p.product_name.trim() !== '').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Product Management</h1>
              <p className="text-gray-400">Manage your brands and products across all markets</p>
            </div>
            <button
              onClick={handleNewProduct}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105"
            >
              + New Product
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Brands</p>
                <p className="text-3xl font-bold text-white">{totalBrands}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Products</p>
                <p className="text-3xl font-bold text-white">{totalProducts}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Active Products</p>
                <p className="text-3xl font-bold text-white">{activeProducts}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {editingProduct ? 'Edit Product' : 'Create New Product'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingProduct(null);
                    setFormData({});
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

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
                    <label className="block text-gray-300 mb-2 font-medium">Market</label>
                    <select 
                      name="market_name" 
                      className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
                      value={formData.market_name || ''} 
                      onChange={handleChange}
                    >
                      <option value="">Select Market</option>
                      {markets.map((m) => (
                        <option key={m.id} value={m.name}>{m.name}</option>
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

                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-700/50">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingProduct(null);
                      setFormData({});
                    }}
                    className="px-6 py-3 bg-gray-700/50 hover:bg-gray-600/50 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105" 
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : (editingProduct ? 'Update Product' : 'Create Product')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Brands and Products */}
        <div className="space-y-8">
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
                      
                      <div className="space-y-2 text-sm">
                        {product.market_name && (
                          <div className="flex items-center text-gray-300">
                            <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                            {product.market_name}
                          </div>
                        )}
                        {product.category && (
                          <div className="text-gray-400">
                            Category: {product.category}
                          </div>
                        )}
                        {product.url && (
                          <div className="text-gray-400 truncate">
                            <a href={product.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">
                              {product.url}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Empty State */}
        {brands.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">No Brands Found</h3>
            <p className="text-gray-400 mb-6">You need to create brands before adding products</p>
            <button
              onClick={() => router.push('/organisation_form')}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105"
            >
              Create Your First Brand
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 