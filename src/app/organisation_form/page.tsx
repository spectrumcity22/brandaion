'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Industry {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  name: string;
}

interface Market {
  id: string;
  name: string;
}

export default function OrganisationForm() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [orgName, setOrgName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgUrl, setOrgUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [industryId, setIndustryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [marketId, setMarketId] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setSessionUser(user);

      // Get organization details
      const { data: org, error } = await supabase
        .from('client_organisation')
        .select('id, organisation_name')
        .eq('auth_user_id', user.id)
        .single();

      if (!error && org) {
        setOrgId(org.id);
        setOrgName(org.organisation_name);
      } else {
        setMessage('❌ No organisation found for this user.');
        return;
      }

      // Load reference data
      await Promise.all([
        loadIndustries(),
        loadMarkets()
      ]);
    })();
  }, [router]);

  const loadIndustries = async () => {
    const { data } = await supabase.from('industries').select('*');
    if (data) setIndustries(data);
  };

  const loadMarkets = async () => {
    const { data } = await supabase.from('markets').select('*');
    if (data) setMarkets(data);
  };

  const loadSubcategories = async (selectedIndustryId: string) => {
    const { data } = await supabase
      .from('subcategories')
      .select('*')
      .eq('industry_id', selectedIndustryId);
    if (data) setSubcategories(data);
  };

  const handleSubmit = async () => {
    if (!sessionUser) {
      setMessage('❌ You must be logged in.');
      return;
    }

    if (!orgId || !orgUrl || !linkedinUrl || !industryId || !subcategoryId || !marketId) {
      setMessage('❌ All fields are required.');
      return;
    }

    setIsSubmitting(true);
    setMessage('Submitting...');

    try {
      // Update the organization
      const { error: updateError } = await supabase
        .from('client_organisation')
        .update({
          organisation_url: orgUrl,
          linkedin_url: linkedinUrl,
          industry_id: industryId,
          subcategory_id: subcategoryId,
          headquarters_market_id: marketId,
          is_active: true
        })
        .eq('auth_user_id', sessionUser.id); // Using auth_user_id for matching

      if (updateError) throw updateError;

      setMessage('✅ Organisation updated successfully!');
      setTimeout(() => router.push('/dashboard'), 1000);
    } catch (err: any) {
      setMessage(`❌ Error: ${err?.message || 'Unexpected failure'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center">
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
          disabled={isSubmitting}
          className={`w-full py-3 font-bold rounded-lg transition ${
            isSubmitting
              ? 'bg-gray-600 text-white cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-black'
          }`}
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>

        <div className="text-sm mt-4 text-center text-red-400">{message}</div>
      </div>
    </div>
  );
} 