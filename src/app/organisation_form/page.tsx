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
  const [industry, setIndustry] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [headquarters, setHeadquarters] = useState('');
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

  const loadSubcategories = async (selectedIndustryName: string) => {
    // Find the industry ID for the selected name
    const selectedIndustry = industries.find((ind) => ind.name === selectedIndustryName);
    if (!selectedIndustry) {
      setSubcategories([]);
      return;
    }
    const { data } = await supabase
      .from('subcategories')
      .select('*')
      .eq('industry_id', selectedIndustry.id);
    if (data) setSubcategories(data);
  };

  const handleSubmit = async () => {
    if (!sessionUser) {
      setMessage('❌ You must be logged in.');
      return;
    }
    if (!orgId || !orgUrl || !linkedinUrl || !industry || !subcategory || !headquarters) {
      setMessage('❌ All fields are required.');
      return;
    }
    setIsSubmitting(true);
    setMessage('Submitting...');
    try {
      // Update the organization with names, not IDs
      const { error: updateError } = await supabase
        .from('client_organisation')
        .update({
          organisation_url: orgUrl,
          linkedin_url: linkedinUrl,
          industry: industry,
          subcategory: subcategory,
          headquarters: headquarters,
          is_active: true
        })
        .eq('auth_user_id', sessionUser.id);
      if (updateError) throw updateError;

      // Call the edge function to create a brand row with JWT
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('❌ Could not get user session for brand creation.');
        setIsSubmitting(false);
        return;
      }
      const brandRes = await fetch('https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/creation_of_brand_row', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          organisation_id: orgId,
          organisation_name: orgName
        })
      });
      if (!brandRes.ok) {
        const errorData = await brandRes.json();
        throw new Error(errorData.error || 'Failed to create brand row');
      }

      setMessage('✅ Organisation and brand row updated successfully!');
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
          value={industry}
          onChange={(e) => {
            setIndustry(e.target.value);
            loadSubcategories(e.target.value);
            setSubcategory(''); // Reset subcategory when industry changes
          }}
          className="w-full p-3 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="">Select Industry</option>
          {industries.map((ind) => (
            <option key={ind.id} value={ind.name}>
              {ind.name}
            </option>
          ))}
        </select>
        
        <select
          value={subcategory}
          onChange={(e) => setSubcategory(e.target.value)}
          className="w-full p-3 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="">Select Subcategory</option>
          {subcategories.map((sub) => (
            <option key={sub.id} value={sub.name}>
              {sub.name}
            </option>
          ))}
        </select>
        
        <select
          value={headquarters}
          onChange={(e) => setHeadquarters(e.target.value)}
          className="w-full p-3 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="">Select Market</option>
          {markets.map((mkt) => (
            <option key={mkt.id} value={mkt.name}>
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
        
        {message.includes('✅') && (
          <div className="mt-4">
            <button
              onClick={() => router.push('/client_brands_form')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Continue to Brands Form
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 