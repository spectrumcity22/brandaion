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

      setProcessingStatus('Configuration saved, merging with schedule...');

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

      setProcessingStatus('Configuration merged. Starting question generation...');

      // Call open_ai_request_questions directly
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

      setProcessingStatus('Questions generation started. Checking status...');

      // Poll for status changes
      let attempts = 0;
      const maxAttempts = 30;
      const pollInterval = 2000; // 2 seconds

      while (attempts < maxAttempts) {
        const { data: pairs, error: statusError } = await supabase
          .from('construct_faq_pairs')
          .select('generation_status, error_message')
          .eq('auth_user_id', user.id)
          .in('generation_status', ['pending', 'completed', 'error']);

        if (statusError) {
          throw new Error(`Failed to check status: ${statusError.message}`);
        }

        if (!pairs || pairs.length === 0) {
          setProcessingStatus('No FAQ pairs found. Please try again.');
          break;
        }

        const hasError = pairs.some(p => p.generation_status === 'error');
        const allCompleted = pairs.every(p => p.generation_status === 'completed');
        const stillPending = pairs.some(p => p.generation_status === 'pending');

        if (hasError) {
          const errorPair = pairs.find(p => p.generation_status === 'error');
          throw new Error(`Question generation failed: ${errorPair?.error_message || 'Unknown error'}`);
        }

        if (allCompleted) {
          setProcessingStatus('Questions generated successfully! Redirecting...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          router.push('/review-questions');
          break;
        }

        if (stillPending) {
          setProcessingStatus(`Still generating questions... (${attempts + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          attempts++;
        }
      }

      if (attempts >= maxAttempts) {
        setProcessingStatus('Question generation is taking longer than expected. You can check the review page for updates.');
        await new Promise(resolve => setTimeout(resolve, 2000));
        router.push('/review-questions');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage("❌ Error: " + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateQuestions = async () => {
    setIsGenerating(true);
    setProcessingStatus('Generating questions...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session found');
      }

      console.log('Making CORS preflight request for questions...');
      const preflightResponse = await fetch("https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/open_ai_request_questions", {
        method: "OPTIONS",
        headers: {
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization, x-client-info, apikey, content-type",
        },
      });

      if (!preflightResponse.ok) {
        throw new Error('CORS preflight failed');
      }

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

      setProcessingStatus('Questions are being generated. Redirecting to review page...');
      
      // Wait a moment to show the status
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Redirect to review questions page
      router.push('/review-questions');
    } catch (error) {
      console.error('Error:', error);
      setMessage("❌ Error: " + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsGenerating(false);
    }
  };

  if (!user) {
    return <div className="text-center p-8">Loading...</div>;
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-8">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg">
        <h2 className="text-xl font-bold mb-4">Configure AI Request</h2>
        <form className="space-y-4">
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
          <div className="space-y-4">
            <button
              type="submit"
              className="w-full p-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-bold transition"
              disabled={isProcessing || !form.brand_id || !form.product_id || !form.persona_id || !form.market_id || !form.audience_id}
            >
              {isProcessing ? 'Saving...' : 'Save Configuration'}
            </button>

            <button
              type="button"
              onClick={handleGenerateQuestions}
              className="w-full p-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold transition"
              disabled={isGenerating || !mergeComplete}
            >
              {isGenerating ? 'Generating...' : 'Generate Questions'}
            </button>
          </div>
          
          {message && <div className="mt-2 text-green-400">{message}</div>}
          {processingStatus && <div className="mt-2 text-blue-400">{processingStatus}</div>}
        </form>
      </div>
    </div>
  );
} 