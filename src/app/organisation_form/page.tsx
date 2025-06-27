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

interface Organisation {
  id: string;
  organisation_name: string;
  organisation_url: string;
  linkedin_url: string;
  industry: string;
  subcategory: string;
  headquarters: string;
}

export default function OrganisationForm() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [existingOrg, setExistingOrg] = useState<Organisation | null>(null);
  const [isEditing, setIsEditing] = useState(false);
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setSessionUser(user);

      // Check if organization already exists (for existing users)
      const { data: org, error } = await supabase
        .from('client_organisation')
        .select('id, organisation_name, organisation_url, linkedin_url, industry, subcategory, headquarters')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (!error && org) {
        // Existing organization - populate form for editing
        setExistingOrg(org);
        setOrgId(org.id);
        setOrgName(org.organisation_name);
        setOrgUrl(org.organisation_url);
        setLinkedinUrl(org.linkedin_url);
        setIndustry(org.industry);
        setSubcategory(org.subcategory);
        setHeadquarters(org.headquarters);
      }

      // Load reference data
      await Promise.all([
        loadIndustries(),
        loadMarkets()
      ]);

      // Load subcategories if industry is already set
      if (org?.industry) {
        await loadSubcategories(org.industry);
      }

      setIsLoading(false);
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
    if (isSubmitting) return;

    // Validate required fields
    if (!orgId && !orgName?.trim()) {
      setMessage('❌ Organisation name is required');
      return;
    }

    if (!orgUrl || !linkedinUrl || !industry || !subcategory || !headquarters) {
      setMessage('Please fill in all fields.');
      return;
    }

    if (!sessionUser) {
      setMessage('User not authenticated.');
      return;
    }

    setIsSubmitting(true);
    setMessage('Creating organisation...');

    try {
      // Step 1: Create or update the organization record
      let organizationId = orgId;
      
      if (!orgId) {
        // Create new organization
        const { data: newOrg, error: createError } = await supabase
          .from('client_organisation')
          .insert({
            organisation_name: orgName,
            organisation_url: orgUrl,
            linkedin_url: linkedinUrl,
            industry: industry,
            subcategory: subcategory,
            headquarters: headquarters,
            auth_user_id: sessionUser.id,
            is_active: true
          })
          .select('id')
          .single();

        if (createError) throw createError;
        organizationId = newOrg.id;
        setMessage('✅ Organisation created! Linking to profile...');
      } else {
        // Update existing organization
        const { error: updateError } = await supabase
          .from('client_organisation')
          .update({
            organisation_name: orgName,
            organisation_url: orgUrl,
            linkedin_url: linkedinUrl,
            industry: industry,
            subcategory: subcategory,
            headquarters: headquarters,
            is_active: true
          })
          .eq('id', orgId);
        
        if (updateError) throw updateError;
        setMessage('✅ Organisation updated! Linking to profile...');
      }

      // Step 2: Wait 2 seconds for database to commit
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Link organization to end_user
      const { error: linkError } = await supabase
        .from('end_users')
        .update({
          org_name: orgName,
          organisation_id: organizationId
        })
        .eq('auth_user_id', sessionUser.id);

      if (linkError) throw linkError;

      setMessage('✅ Organisation and profile linked successfully!');

      // Update existing org state
      setExistingOrg({
        id: organizationId,
        organisation_name: orgName,
        organisation_url: orgUrl,
        linkedin_url: linkedinUrl,
        industry: industry,
        subcategory: subcategory,
        headquarters: headquarters
      });
      setIsEditing(false);

      // Step 4: Call the edge function to create a brand row with JWT
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
          organisation_id: organizationId,
          organisation_name: orgName
        })
      });
      
      if (!brandRes.ok) {
        const errorData = await brandRes.json();
        throw new Error(errorData.error || 'Failed to create brand row');
      }

      setMessage('✅ Organisation, profile, and brand row created successfully!');
      
      // Remove auto-redirect - let user stay on the page
    } catch (err: any) {
      setMessage(`❌ Error: ${err?.message || 'Unexpected failure'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading organisation...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show existing organisation with edit button
  if (existingOrg && !isEditing) {
    return (
      <div className="min-h-screen p-4 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="glass-card p-8 text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full premium-gradient flex items-center justify-center text-2xl glow-animation">
              🏢
            </div>
            <h1 className="text-3xl font-bold mb-2 shimmer-text">Your Organisation</h1>
            <p className="text-gray-400">Your organisation is already configured</p>
          </div>

          <div className="glass-card p-8">
            <div className="mb-6 p-4 glass-card text-center">
              <div className="text-2xl mb-2">📛</div>
              <h2 className="text-xl font-semibold mb-1">{existingOrg.organisation_name}</h2>
              <p className="text-gray-400 text-sm">Organisation Ready for Configuration</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="flex justify-between items-center p-4 bg-gray-800/30 rounded-lg">
                <div>
                  <p className="text-gray-400 text-sm">Website</p>
                  <p className="text-white font-medium truncate">{existingOrg.organisation_url}</p>
                </div>
                <div className="text-green-400">✓</div>
              </div>

              <div className="flex justify-between items-center p-4 bg-gray-800/30 rounded-lg">
                <div>
                  <p className="text-gray-400 text-sm">LinkedIn</p>
                  <p className="text-white font-medium truncate">{existingOrg.linkedin_url}</p>
                </div>
                <div className="text-green-400">✓</div>
              </div>

              <div className="flex justify-between items-center p-4 bg-gray-800/30 rounded-lg">
                <div>
                  <p className="text-gray-400 text-sm">Industry</p>
                  <p className="text-white font-medium">{existingOrg.industry}</p>
                </div>
                <div className="text-green-400">✓</div>
              </div>

              <div className="flex justify-between items-center p-4 bg-gray-800/30 rounded-lg">
                <div>
                  <p className="text-gray-400 text-sm">Subcategory</p>
                  <p className="text-white font-medium">{existingOrg.subcategory}</p>
                </div>
                <div className="text-green-400">✓</div>
              </div>

              <div className="md:col-span-2 flex justify-between items-center p-4 bg-gray-800/30 rounded-lg">
                <div>
                  <p className="text-gray-400 text-sm">Headquarters</p>
                  <p className="text-white font-medium">{existingOrg.headquarters}</p>
                </div>
                <div className="text-green-400">✓</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setIsEditing(true)}
                className="premium-button flex-1"
              >
                ✏️ Edit Organisation
              </button>
              
              <button
                onClick={() => router.push('/dashboard')}
                className="glass-input p-4 hover:bg-white/10 transition-colors"
              >
                🏠 Back to Dashboard
              </button>
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
              <p className="text-blue-400 mb-3">Next step: Set up your brand management</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => router.push('/select_package')}
                  className="premium-button"
                >
                  📦 Select Package
                </button>
                <button
                  onClick={() => router.push('/client_brands_form')}
                  className="premium-button"
                >
                  🏷️ Brand Management
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show edit form or new organisation form
  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="glass-card p-8 text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full premium-gradient flex items-center justify-center text-2xl glow-animation">
            🏢
          </div>
          <h1 className="text-3xl font-bold mb-2 shimmer-text">
            {existingOrg ? 'Edit Your Organisation' : 'Define Your Organisation'}
          </h1>
          <p className="text-gray-400">
            {existingOrg ? 'Update your organisation information' : 'Complete your organisation profile to unlock premium features'}
          </p>
        </div>

        <div className="glass-card p-8">
          {orgId ? (
            // Existing organization - show current name
            <div className="mb-6 p-4 glass-card text-center">
              <div className="text-2xl mb-2">📛</div>
              <h2 className="text-xl font-semibold mb-1">{orgName}</h2>
              <p className="text-gray-400 text-sm">Organisation Ready for Configuration</p>
            </div>
          ) : (
            // New organization - show input field
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                🏢 Organisation Name
              </label>
              <input
                type="text"
                placeholder="Enter your organisation name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="glass-input w-full p-4"
                required
              />
            </div>
          )}

          {message && (
            <div className={`mb-6 p-4 rounded-lg text-center ${
              message.includes('❌') 
                ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                : 'bg-green-500/10 text-green-400 border border-green-500/20'
            }`}>
              {message}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                🌐 Organisation Website URL
              </label>
              <input
                type="url"
                placeholder="https://yourcompany.com"
                value={orgUrl}
                onChange={(e) => setOrgUrl(e.target.value)}
                className="glass-input w-full p-4"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                💼 LinkedIn Profile URL
              </label>
              <input
                type="url"
                placeholder="https://www.linkedin.com/company/yourcompany"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className="glass-input w-full p-4"
              />
              <p className="text-xs text-gray-500 mt-1">
                Just add your company name after https://www.linkedin.com/company/
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                🏭 Industry
              </label>
              <select
                value={industry}
                onChange={(e) => {
                  setIndustry(e.target.value);
                  loadSubcategories(e.target.value);
                  setSubcategory(''); // Reset subcategory when industry changes
                }}
                className="glass-input w-full p-4"
              >
                <option value="">Select Industry</option>
                {industries.map((ind) => (
                  <option key={ind.id} value={ind.name}>
                    {ind.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                📊 Subcategory
              </label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="glass-input w-full p-4"
                disabled={!industry}
              >
                <option value="">{industry ? 'Select Subcategory' : 'Select Industry First'}</option>
                {subcategories.map((sub) => (
                  <option key={sub.id} value={sub.name}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                🏢 Headquarters
              </label>
              <select
                value={headquarters}
                onChange={(e) => setHeadquarters(e.target.value)}
                className="glass-input w-full p-4"
              >
                <option value="">Select Market</option>
                {markets.map((mkt) => (
                  <option key={mkt.id} value={mkt.name}>
                    {mkt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`premium-button flex-1 ${isSubmitting ? 'premium-loading' : ''}`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
                  {orgId ? 'Updating Organisation...' : 'Creating Organisation...'}
                </div>
              ) : (
                `✨ ${orgId ? 'Update' : 'Create'} Organisation`
              )}
            </button>
            
            {existingOrg && (
              <button
                onClick={() => setIsEditing(false)}
                className="glass-input p-4 hover:bg-white/10 transition-colors"
              >
                ❌ Cancel
              </button>
            )}
            
            <button
              onClick={() => router.push('/dashboard')}
              className="glass-input p-4 hover:bg-white/10 transition-colors"
            >
              🏠 Back to Dashboard
            </button>
          </div>
        </div>

        {/* Help Section */}
        <div className="glass-card p-8 mt-8">
          <h2 className="text-2xl font-bold mb-6">💡 Need Help?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="font-semibold mb-2">Complete Profile</h3>
              <p className="text-gray-400 text-sm">Fill in all fields to unlock advanced features</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">🔗</div>
              <h3 className="font-semibold mb-2">Valid URLs</h3>
              <p className="text-gray-400 text-sm">Ensure your website and LinkedIn URLs are correct</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">📈</div>
              <h3 className="font-semibold mb-2">Better Results</h3>
              <p className="text-gray-400 text-sm">Detailed organisation info improves FAQ quality</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 