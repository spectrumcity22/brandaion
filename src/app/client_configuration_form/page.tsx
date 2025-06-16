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
        .select("id, brand_name, organisation_name")
        .eq("auth_user_id", user.id);
      setBrands(brandsData || []);
    })();
  }, []);

  useEffect(() => {
    if (!form.brand_id) return;
    (async () => {
      const { data: productsData } = await supabase
        .from("products")
        .select("id, product_name")
        .eq("brand_id", form.brand_id);
      setProducts(productsData || []);
    })();
  }, [form.brand_id]);

  useEffect(() => {
    if (!form.product_id) return;
    (async () => {
      const { data: personasData } = await supabase
        .from("client_product_persona")
        .select("id, persona_name")
        .eq("product_id", form.product_id);
      setPersonas(personasData || []);
    })();
  }, [form.product_id]);

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
      const { error: configError } = await supabase
        .from('client_configuration')
        .upsert({
          auth_user_id: user.id,
          product_name: products.find(p => p.id === form.product_id)?.product_name,
          persona_name: personas.find(p => p.id === form.persona_id)?.persona_name,
          audience_name: audiences.find(a => a.id === form.audience_id)?.target_audience,
          market_name: markets.find(m => m.id === form.market_id)?.name,
          brand_jsonld_object: brands.find(b => b.id === form.brand_id)?.brand_jsonld_object,
          schema_json: products.find(p => p.id === form.product_id)?.schema_json,
          persona_jsonld: personas.find(p => p.id === form.persona_id)?.persona_jsonld
        }, { onConflict: "auth_user_id" });

      if (configError) {
        throw new Error(`Failed to save configuration: ${configError.message}`);
      }

      setProcessingStatus('Merging with schedule...');

      // Get the session for the webhook call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session found');
      }

      // Call merge_schedule_and_configuration which will:
      // 1. Update existing rows in construct_faq_pairs with merged data
      // 2. Set status to 'pending'
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

      setProcessingStatus('Merge complete. Waiting 5 seconds before generating questions...');
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay after merge

      // Call open_ai_request_questions for pending rows
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

      setMessage("✅ Configuration saved and questions generation started!");
      router.push('/review-questions');
    } catch (error) {
      console.error('Error:', error);
      setMessage("❌ Error: " + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!user) {
    return <div className="text-center p-8">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Client Configuration</h1>
      
      {message && (
        <div className={`p-4 mb-4 rounded ${message.includes('❌') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      {processingStatus && (
        <div className="p-4 mb-4 bg-blue-100 text-blue-700 rounded">
          {processingStatus}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Brand</label>
          <select
            name="brand_id"
            value={form.brand_id || ''}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
          <label className="block text-sm font-medium text-gray-700">Product</label>
          <select
            name="product_id"
            value={form.product_id || ''}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            required
          >
            <option value="">Select a product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.product_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Persona</label>
          <select
            name="persona_id"
            value={form.persona_id || ''}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
          <label className="block text-sm font-medium text-gray-700">Market</label>
          <select
            name="market_id"
            value={form.market_id || ''}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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

        <div>
          <label className="block text-sm font-medium text-gray-700">Audience</label>
          <select
            name="audience_id"
            value={form.audience_id || ''}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            required
          >
            <option value="">Select an audience</option>
            {audiences.map((audience) => (
              <option key={audience.id} value={audience.id}>
                {audience.target_audience}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="submit"
            disabled={isProcessing}
            className={`px-4 py-2 rounded-md text-white ${
              isProcessing ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isProcessing ? 'Processing...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
} 