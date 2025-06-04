'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function OrganisationForm() {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgUrl, setOrgUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [industries, setIndustries] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [markets, setMarkets] = useState<any[]>([]);
  const [industryId, setIndustryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [marketId, setMarketId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // ✅ Pull org ID from localStorage OR query string
      const id = localStorage.getItem('organisation_id') ||
                 new URLSearchParams(window.location.search).get('org_id');

      if (!id) {
        setMessage('❌ No organisation context found. Please go back.');
        return;
      }

      setOrgId(id);
      loadOrgName(id);
      loadIndustries();
      loadMarkets();
    })();
  }, []);

  const loadOrgName = async (id: string) => {
    const { data, error } = await supabase
      .from('client_organisation')
      .select('organisation_name')
      .eq('id', id)
      .single();
    if (!error && data) {
      setOrgName(data.organisation_name);
    } else {
      setMessage('❌ Failed to fetch organisation. Please restart the flow.');
    }
  };

  const loadIndustries = async () => {
    const { data } = await supabase.from('industries').select();
    if (data) setIndustries(data);
  };

  const loadMarkets = async () => {
    const { data } = await supabase.from('markets').select();
    if (data) setMarkets(data);
  };

  const loadSubcategories = async (industryId: string) => {
    const { data } = await supabase
      .from('subcategories')
      .select()
      .eq('industry_id', industryId);
    if (data) setSubcategories(data);
  };

  const handleSubmit = async () => {
    setMessage('Submitting...');

    const { data: { user }, error: sessionError } = await supabase.auth.getUser();
    if (!user || sessionError) {
      setMessage('❌ You must be logged in.');
      return;
    }

    const { data: endUser, error: endUserError } = await supabase
      .from('end_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (endUserError || !endUser) {
      setMessage('❌ End user record not found.');
      return;
    }

    if (!orgId || !orgUrl || !linkedinUrl || !industryId || !subcategoryId || !marketId) {
      setMessage('❌ All fields are required.');
      return;
    }

    const { error: updateError } = await supabase
      .from('client_organisation')
      .update({
        organisation_url: orgUrl,
        linkedin_url: linkedinUrl,
        industry_id: industryId,
        subcategory_id: subcategoryId,
        headquarters_market_id: marketId,
        end_user_id: endUser.id,
        is_active: true
      })
      .eq('id', orgId);

    if (updateError) {
      setMessage('❌ Failed to update organisation: ' + updateError.message);
    } else {
      setMessage('✅ Organisation updated successfully!');
      setTimeout(() => router.push('/dashboard'), 1000);
    }
  };

  return (
    <div className="bg-black text-white pt-24 flex flex-col items-center min-h-screen">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg w-full max-w-md text-center">
        <h2 className="text-xl font-bold mb-4">Define Your Organisation</h2>
        <div className="text-sm text-gray-400 mb-4">
          {orgName ? `📛 Organisation: ${orgName}` : '🔄 Loading organisation...'}
        </div>
        <input
          type="url"
          placeholder="Organisation Website URL"
          value={orgUrl}
          onChange={(e) => setOrgUrl(e.target.value)}
          className="w-full p-3 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white"
        />
        <input
          type="url"
          placeholder="LinkedIn Profile URL"
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          className="w-full p-3 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white"
        />
        <select
          value={industryId}
          onChange={(e) => {
            setIndustryId(e.target.value);
            loadSubcategories(e.target.value);
          }}
          className="w-full p-3 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="">Select Industry</option>
          {industries.map((ind) => (
            <option key={ind.id} value={ind.id}>
              {ind.name}
            </option>
          ))}
        </select>
        <select
          value={subcategoryId}
          onChange={(e) => setSubcategoryId(e.target.value)}
          className="w-full p-3 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="">Select Subcategory</option>
          {subcategories.map((sub) => (
            <option key={sub.id} value={sub.id}>
              {sub.name}
            </option>
          ))}
        </select>
        <select
          value={marketId}
          onChange={(e) => setMarketId(e.target.value)}
          className="w-full p-3 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="">Select Market</option>
          {markets.map((mkt) => (
            <option key={mkt.id} value={mkt.id}>
              {mkt.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleSubmit}
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-black font-bold rounded-lg transition"
        >
          Submit
        </button>
        <div className="text-sm text-red-400 mt-4">{message}</div>
      </div>
    </div>
  );
}
