"use client";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ClientConfigurationForm() {
  const [brands, setBrands] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [markets, setMarkets] = useState<any[]>([]);
  const [audiences, setAudiences] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [session, setSession] = useState<any>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mergeComplete, setMergeComplete] = useState(false);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [hasInvoice, setHasInvoice] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [status, setStatus] = useState('');
  const [organisation, setOrganisation] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);
      
      // Fetch brands for this user/org
      const { data: brandsData } = await supabase
        .from("brands")
        .select("id, brand_name, organisation_name, brand_jsonld_object")
        .eq("auth_user_id", user.id);
      setBrands(brandsData || []);
      
      // Fetch organization data for this user
      const { data: orgData, error: orgError } = await supabase
        .from("client_organisation")
        .select("id, organisation_name, organisation_jsonld_object")
        .eq("auth_user_id", user.id)
        .single();
      
      if (orgError) {
        console.warn('No organization found for user:', user.id, orgError);
        setOrganisation(null);
        
        // Try to create a basic organization record if none exists
        const { data: newOrg, error: createError } = await supabase
          .from("client_organisation")
          .insert({
            auth_user_id: user.id,
            organisation_name: "Default Organization",
            organisation_url: "",
            linkedin_url: "",
            industry: "",
            subcategory: "",
            headquarters: ""
          })
          .select("id, organisation_name, organisation_jsonld_object")
          .single();
        
        if (createError) {
          console.error('Failed to create organization:', createError);
        } else {
          console.log('Created default organization:', newOrg);
          setOrganisation(newOrg);
        }
      } else {
        console.log('Found organization data:', orgData);
        setOrganisation(orgData);
      }
      
      // Load all personas for the user immediately
      const { data: personasData } = await supabase
        .from("client_product_persona")
        .select("id, persona_name, persona_jsonld")
        .eq("auth_user_id", user.id);
      setPersonas(personasData || []);
      
      // Fetch schedule
      const { data: scheduleData } = await supabase
        .from('schedule')
        .select('id')
        .eq('auth_user_id', user.id);
      setHasSchedule(!!(scheduleData && scheduleData.length > 0));
      
      // Fetch configuration
      const { data: configData } = await supabase
        .from('client_configuration')
        .select('id')
        .eq('auth_user_id', user.id);
      setHasConfig(!!(configData && configData.length > 0));
      
      // Set status
      if (!scheduleData || scheduleData.length === 0) {
        setStatus('No Schedule');
      } else if (configData && configData.length > 0) {
        setStatus('Created');
      } else {
        setStatus('Pending');
      }
    })();
  }, []);

  useEffect(() => {
    if (!form.brand_id) return;
    (async () => {
      const { data: productsData } = await supabase
        .from("products")
        .select("id, product_name, schema_json")
        .eq("brand_id", form.brand_id);
      setProducts(productsData || []);
    })();
  }, [form.brand_id]);

  useEffect(() => {
    (async () => {
      const { data: marketsData } = await supabase.from("markets").select("id, name");
      setMarkets(marketsData || []);
      const { data: audiencesData } = await supabase.from("audiences").select("id, target_audience");
      setAudiences(audiencesData || []);
    })();
  }, []);

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setProcessingStatus('Saving configuration...');

    try {
      // First save to client_configuration
      const configData = {
        auth_user_id: user.id,
        brand_id: form.brand_id,
        product_id: form.product_id || null,
        persona_id: form.persona_id,
        market_id: form.market_id,
        audience_id: form.audience_id,
        product_name: products.find(p => p.id === form.product_id)?.product_name || null,
        persona_name: personas.find(p => p.id === form.persona_id)?.persona_name,
        audience_name: audiences.find(a => a.id === form.audience_id)?.target_audience,
        market_name: markets.find(m => m.id === form.market_id)?.name,
        brand_jsonld_object: brands.find(b => b.id === form.brand_id)?.brand_jsonld_object,
        schema_json: products.find(p => p.id === form.product_id)?.schema_json || null,
        persona_jsonld: personas.find(p => p.id === form.persona_id)?.persona_jsonld,
        organisation_jsonld_object: organisation?.organisation_jsonld_object || null
      };
      
      console.log('Saving configuration with data:', {
        ...configData,
        organisation_jsonld_object: configData.organisation_jsonld_object ? 'Present' : 'NULL'
      });
      
      const { error: configError } = await supabase
        .from('client_configuration')
        .upsert(configData, { onConflict: "auth_user_id" });

      if (configError) {
        throw new Error(`Failed to save configuration: ${configError.message}`);
      }

      setProcessingStatus('Configuration saved. Merging with schedule data...');

      // Get the session for the webhook call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session found');
      }

      // Call merge_schedule_and_configuration
      const mergeResponse = await fetch("https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/merge_schedule_and_configuration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "x-client-info": "supabase-js/2.39.3",
          "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        },
        body: JSON.stringify({ auth_user_id: user.id }),
      });

      const mergeData = await mergeResponse.json();
      
      if (!mergeResponse.ok) {
        throw new Error(`Merge failed: ${mergeData.error || 'Unknown error'}`);
      }

      // Check if any schedule rows were processed
      if (mergeData.processed_count === 0) {
        setProcessingStatus('No schedule rows found to process. Please ensure you have completed the payment and schedule creation.');
        setMessage("⚠️ No schedule rows found. Please check your payment status and try again.");
        return;
      }

      setProcessingStatus(`Merge complete! Processed ${mergeData.processed_count} schedule rows. Starting question generation...`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay after merge

      // Call open_ai_request_questions for pending rows
      setProcessingStatus('Generating AI questions...');
      const questionsResponse = await fetch("https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/open_ai_request_questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "x-client-info": "supabase-js/2.39.3",
          "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        },
        body: JSON.stringify({ auth_user_id: user.id }),
      });

      const questionsData = await questionsResponse.json();
      if (!questionsResponse.ok) {
        throw new Error(`Questions generation failed: ${questionsData.error || 'Unknown error'}`);
      }

      setMessage(`✅ Configuration saved and ${mergeData.processed_count} FAQ batches queued for generation!`);
      setProcessingStatus('Redirecting to review questions...');
      
      setTimeout(() => {
        router.push('/review-questions');
      }, 2000);
      
    } catch (error) {
      console.error('Error:', error);
      setMessage("❌ Error: " + (error instanceof Error ? error.message : 'Unknown error'));
      setProcessingStatus('');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  const totalBrands = brands.length;
  const totalProducts = products.length;
  const totalPersonas = personas.length;
  const isFormComplete = form.brand_id && form.persona_id && form.market_id && form.audience_id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">AI Configuration Center</h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Configure your AI-powered FAQ generation system by selecting your brand, product, persona, market, and target audience. 
              This setup will determine how your AI generates personalized questions and answers for your FAQ content.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Available Brands</p>
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
                <p className="text-gray-400 text-sm">Available Products</p>
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
                <p className="text-gray-400 text-sm">Available Personas</p>
                <p className="text-3xl font-bold text-white">{totalPersonas}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-600/20 to-red-600/20 border border-orange-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Configuration Status</p>
                <p className="text-3xl font-bold text-white">{status}</p>
              </div>
              <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {message && (
          <div className={`p-6 mb-6 rounded-xl border ${
            message.includes('❌') 
              ? 'bg-red-900/20 border-red-500/50 text-red-400' 
              : 'bg-green-900/20 border-green-500/50 text-green-400'
          }`}>
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {message.includes('❌') ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
              {message}
            </div>
          </div>
        )}

        {processingStatus && (
          <div className="p-6 mb-6 bg-blue-900/20 border border-blue-500/50 text-blue-400 rounded-xl">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400 mr-3"></div>
              {processingStatus}
            </div>
          </div>
        )}

        {/* Configuration Form */}
        <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">AI Configuration Setup</h2>
            <p className="text-gray-400">Select your brand, product, persona, market, and target audience to define your AI&apos;s context.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-300 mb-2 font-medium">Brand</label>
                <select
                  name="brand_id"
                  value={form.brand_id || ''}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  required
                >
                  <option value="">Select a brand</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.brand_name} ({brand.organisation_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-300 mb-2 font-medium">Product (Optional)</label>
                <select
                  name="product_id"
                  value={form.product_id || ''}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  disabled={!form.brand_id}
                >
                  <option value="">Select a product (optional)</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.product_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-300 mb-2 font-medium">Persona</label>
                <select
                  name="persona_id"
                  value={form.persona_id || ''}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  required
                >
                  <option value="">Select a persona</option>
                  {personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.persona_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-300 mb-2 font-medium">Market</label>
                <select
                  name="market_id"
                  value={form.market_id || ''}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  required
                >
                  <option value="">Select a market</option>
                  {markets.map((market) => (
                    <option key={market.id} value={market.id}>
                      {market.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-gray-300 mb-2 font-medium">Target Audience</label>
                <select
                  name="audience_id"
                  value={form.audience_id || ''}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  required
                >
                  <option value="">Select target audience</option>
                  {audiences.map((audience) => (
                    <option key={audience.id} value={audience.id}>
                      {audience.target_audience}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-700/50">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 bg-gray-700/50 hover:bg-gray-600/50 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={isProcessing || !isFormComplete || !hasSchedule}
              >
                {isProcessing ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  'Configure AI & Generate Questions'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-gray-900/30 border border-gray-700/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">How This Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-300">
            <div>
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center mb-3">
                <span className="text-blue-400 font-bold">1</span>
              </div>
              <h4 className="font-medium text-white mb-2">Configuration</h4>
              <p>Select your brand, product, persona, market, and target audience to define your AI&apos;s context.</p>
            </div>
            <div>
              <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center mb-3">
                <span className="text-green-400 font-bold">2</span>
              </div>
              <h4 className="font-medium text-white mb-2">AI Processing</h4>
              <p>Our AI system merges your configuration with existing schedules and generates personalized questions.</p>
            </div>
            <div>
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center mb-3">
                <span className="text-purple-400 font-bold">3</span>
              </div>
              <h4 className="font-medium text-white mb-2">Review & Approve</h4>
              <p>Review the generated questions and answers, then approve them for your FAQ content.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 