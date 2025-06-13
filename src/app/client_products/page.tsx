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
  market: string;
  product_name: string;
  description: string;
  keywords: string;
  url: string;
  category: string;
  schema_json: any;
  brand_id?: string;
}

interface MarketOption {
  id: string;
  name: string;
}

export default function ClientProducts() {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markets, setMarkets] = useState<MarketOption[]>([]);
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [saving, setSaving] = useState(false);
  const [brands, setBrands] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!user || authError) {
        router.push('/login');
        return;
      }
      // Fetch the product for this user
      const { data, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('auth_user_id', user.id)
        .order('inserted_at', { ascending: false })
        .limit(1)
        .single();
      if (productError) {
        setError('Failed to load product.');
      } else if (data) {
        setProduct(data);
        setFormData(data);
      }
      // Fetch brands for this user/org
      const { data: brandsData } = await supabase
        .from('brands')
        .select('id, brand_name, organisation_name')
        .eq('auth_user_id', user.id);
      setBrands(brandsData || []);
      // Fetch markets for dropdown
      const { data: marketData } = await supabase
        .from('markets')
        .select('id, name');
      if (marketData) setMarkets(marketData);
      setLoading(false);
    })();
  }, [router]);

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
          organisation: product?.organisation || '',
          brand_id: formData.brand_id,
        })
        .select()
        .single();

      if (error) throw error;
      
      setProduct(data);
      setError('');
    } catch (err) {
      console.error('Error saving product:', err);
      setError('Error saving product.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4">Loading Product...</h1>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto pt-8">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">Your Product</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 mb-1">User Email</label>
              <input className="w-full p-2 rounded bg-gray-800 text-gray-200" value={formData.user_email || ''} readOnly />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Organisation</label>
              <input className="w-full p-2 rounded bg-gray-800 text-gray-200" value={formData.organisation || ''} readOnly />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Brand</label>
              <select
                name="brand_id"
                className="w-full p-2 rounded bg-gray-800 text-gray-200"
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
              <label className="block text-gray-400 mb-1">Market</label>
              <select name="market" className="w-full p-2 rounded bg-gray-800 text-gray-200" value={formData.market || ''} onChange={handleChange}>
                <option value="">Select Market</option>
                {markets.map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Product Name</label>
              <input name="product_name" className="w-full p-2 rounded bg-gray-800 text-gray-200" value={formData.product_name || ''} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Description</label>
              <textarea name="description" className="w-full p-2 rounded bg-gray-800 text-gray-200" value={formData.description || ''} onChange={handleChange} rows={2} />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Keywords</label>
              <input name="keywords" className="w-full p-2 rounded bg-gray-800 text-gray-200" value={formData.keywords || ''} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">URL</label>
              <input name="url" className="w-full p-2 rounded bg-gray-800 text-gray-200" value={formData.url || ''} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Category</label>
              <input name="category" className="w-full p-2 rounded bg-gray-800 text-gray-200" value={formData.category || ''} onChange={handleChange} />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={saving}>
              {saving ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 