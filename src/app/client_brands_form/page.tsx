"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ClientBrandsForm() {
  const router = useRouter();
  const [brandName, setBrandName] = useState('');
  const [brandUrl, setBrandUrl] = useState('');
  const [brandJsonld, setBrandJsonld] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [brandId, setBrandId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      // Get the latest brand for this user/org
      const { data: brand, error } = await supabase
        .from('brands')
        .select('*')
        .eq('auth_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (brand) {
        setBrandId(brand.id);
        setBrandName(brand.brand_name || '');
        setBrandUrl(brand.brand_url || '');
        setBrandJsonld(brand.brand_jsonld_object || '');
      }
      setLoading(false);
    })();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Saving...');
    if (!brandId) {
      setMessage('No brand found to update.');
      return;
    }
    const { error } = await supabase
      .from('brands')
      .update({
        brand_name: brandName,
        brand_url: brandUrl
      })
      .eq('id', brandId);
    if (error) {
      setMessage('❌ Error saving brand: ' + error.message);
    } else {
      setMessage('✅ Brand updated successfully! Redirecting...');
      setTimeout(() => router.push('/select_package'), 1000);
    }
  };

  if (loading) {
    return <div className="w-full max-w-md mx-auto p-8 text-center">Loading...</div>;
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center">
        <h2 className="text-xl font-bold mb-4">Brand Details</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Brand Name"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            className="w-full p-3 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white"
          />
          <input
            type="url"
            placeholder="Brand URL (e.g. https://www.example.com)"
            value={brandUrl}
            onChange={(e) => setBrandUrl(e.target.value)}
            className="w-full p-3 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white"
          />
          <button
            type="submit"
            className="w-full py-3 font-bold rounded-lg transition bg-green-500 hover:bg-green-600 text-black"
          >
            Save Brand
          </button>
        </form>
        <div className="text-sm mt-4 text-center text-green-400">{message}</div>
      </div>
    </div>
  );
} 