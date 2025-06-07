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
  inserted_at: string;
  market: string;
  product_name: string;
  description: string;
  keywords: string;
  url: string;
  brand_name: string;
  category: string;
  schema_json: any;
}

export default function ClientProducts() {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      }
      setLoading(false);
    })();
  }, [router]);

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

  if (!product) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4">No Product Found</h1>
          <p className="text-gray-400">No product has been created for your account yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto pt-8">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">Your Product</h1>
        <form className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 mb-1">Product ID</label>
              <input className="w-full p-2 rounded bg-gray-800 text-gray-200" value={product.id} readOnly />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Auth User ID</label>
              <input className="w-full p-2 rounded bg-gray-800 text-gray-200" value={product.auth_user_id} readOnly />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">User Email</label>
              <input className="w-full p-2 rounded bg-gray-800 text-gray-200" value={product.user_email} readOnly />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Organisation</label>
              <input className="w-full p-2 rounded bg-gray-800 text-gray-200" value={product.organisation} readOnly />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Inserted At</label>
              <input className="w-full p-2 rounded bg-gray-800 text-gray-200" value={product.inserted_at} readOnly />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Market</label>
              <input className="w-full p-2 rounded bg-gray-800 text-gray-200" value={product.market || ''} />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Product Name</label>
              <input className="w-full p-2 rounded bg-gray-800 text-gray-200" value={product.product_name || ''} />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Description</label>
              <textarea className="w-full p-2 rounded bg-gray-800 text-gray-200" value={product.description || ''} rows={2} />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Keywords</label>
              <input className="w-full p-2 rounded bg-gray-800 text-gray-200" value={product.keywords || ''} />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">URL</label>
              <input className="w-full p-2 rounded bg-gray-800 text-gray-200" value={product.url || ''} />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Brand Name</label>
              <input className="w-full p-2 rounded bg-gray-800 text-gray-200" value={product.brand_name || ''} />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Category</label>
              <input className="w-full p-2 rounded bg-gray-800 text-gray-200" value={product.category || ''} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-gray-400 mb-1">Schema JSON</label>
              <textarea className="w-full p-2 rounded bg-gray-800 text-gray-200" value={JSON.stringify(product.schema_json, null, 2)} readOnly rows={4} />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 