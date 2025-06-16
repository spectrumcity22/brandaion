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
    setProcessingStatus('Starting configuration processing...');

    try {
      // Save the configuration
      const { error } = await supabase
        .from('construct_faq_pairs')
        .insert({
          auth_user_id: user.id,
          product_name: products.find(p => p.id === form.product_id)?.product_name,
          persona_name: personas.find(p => p.id === form.persona_id)?.persona_name,
          audience_name: audiences.find(a => a.id === form.audience_id)?.target_audience,
          market_name: markets.find(m => m.id === form.market_id)?.name,
          generation_status: 'pending'
        });

      if (error) {
        console.error('Error saving configuration:', error);
        setMessage("❌ Error: " + error.message);
        return;
      }

      setProcessingStatus('Configuration saved, starting question generation...');

      // Call the webhook after successful save
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session found');
      }

      console.log('Session token available:', !!session.access_token);
      
      // First, make an OPTIONS request to handle CORS preflight for merge_schedule_and_configuration
      console.log('Making CORS preflight request for merge...');
      const preflightResponse = await fetch("https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/merge_schedule_and_configuration", {
        method: "OPTIONS",
        headers: {
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization, x-client-info, apikey, content-type",
        },
      });

      if (!preflightResponse.ok) {
        console.error('CORS preflight failed:', preflightResponse.status, preflightResponse.statusText);
        throw new Error('CORS preflight failed');
      }

      console.log('CORS preflight successful, making POST request to merge...');

      // Then make the actual POST request to merge_schedule_and_configuration
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
      console.log('Merge response:', {
        status: mergeResponse.status,
        statusText: mergeResponse.statusText,
        data: mergeData
      });

      if (!mergeResponse.ok) {
        throw new Error(`Merge failed: ${mergeData.error || 'Unknown error'}`);
      }

      setProcessingStatus('Configuration merged, requesting questions...');

      // Now make the request to generate questions
      console.log('Making CORS preflight request for questions...');
      const questionsPreflightResponse = await fetch("https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/open_ai_request_questions", {
        method: "OPTIONS",
        headers: {
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization, x-client-info, apikey, content-type",
        },
      });

      if (!questionsPreflightResponse.ok) {
        console.error('Questions CORS preflight failed:', questionsPreflightResponse.status, questionsPreflightResponse.statusText);
        throw new Error('Questions CORS preflight failed');
      }

      console.log('Questions CORS preflight successful, making POST request...');

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
      console.log('Questions response:', {
        status: questionsResponse.status,
        statusText: questionsResponse.statusText,
        data: questionsData
      });

      if (!questionsResponse.ok) {
        throw new Error(`Questions generation failed: ${questionsData.error || 'Unknown error'}`);
      }

      setProcessingStatus('Questions are being generated. Redirecting to review page...');
      
      // Wait a moment to show the status
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Redirect to review questions page
      router.push('/review-questions');
    } catch (error) {
      console.error('Error:', error);
      setMessage("❌ Error: " + (error instanceof Error ? error.message : 'Unknown error'));
      setIsProcessing(false);
    }
  };

  if (!user) {
    return <div className="text-center p-8">Loading...</div>;
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-8">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg">
        <h2 className="text-xl font-bold mb-4">Configure AI Request</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-400 mb-1">Brand</label>
            <select
              name="brand_id"
              value={form.brand_id || ""}
              onChange={handleChange}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
              required
            >
              <option value="">Select Brand</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.brand_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Product</label>
            <select
              name="product_id"
              value={form.product_id || ""}
              onChange={handleChange}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
              required
            >
              <option value="">Select Product</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Persona</label>
            <select
              name="persona_id"
              value={form.persona_id || ""}
              onChange={handleChange}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
              required
            >
              <option value="">Select Persona</option>
              {personas.map(p => <option key={p.id} value={p.id}>{p.persona_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Market</label>
            <select
              name="market_id"
              value={form.market_id || ""}
              onChange={handleChange}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
              required
            >
              <option value="">Select Market</option>
              {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Audience</label>
            <select
              name="audience_id"
              value={form.audience_id || ""}
              onChange={handleChange}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
              required
            >
              <option value="">Select Audience</option>
              {audiences.map(a => <option key={a.id} value={a.id}>{a.target_audience}</option>)}
            </select>
          </div>
          <div>
            <button
              type="submit"
              className="w-full p-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold transition"
              disabled={isProcessing || !form.brand_id || !form.product_id || !form.persona_id || !form.market_id || !form.audience_id}
            >
              {isProcessing ? 'Processing...' : 'Save and Process Configuration'}
            </button>
          </div>
          
          {message && <div className="mt-2 text-green-400">{message}</div>}
          {processingStatus && <div className="mt-2 text-blue-400">{processingStatus}</div>}
        </form>
      </div>
    </div>
  );
} 