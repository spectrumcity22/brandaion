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
  const router = useRouter();

  useEffect(() => {
    (async () => {
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
    setMessage("Saving...");

    try {
      // Find names from loaded lists
      const brand = brands.find(b => b.id === form.brand_id);
      const product = products.find(p => p.id === form.product_id);
      const persona = personas.find(p => p.id === form.persona_id);
      const market = markets.find(m => m.id === form.market_id);
      const audience = audiences.find(a => a.id === form.audience_id);

      console.log('Saving configuration with data:', {
        auth_user_id: user.id,
        brand_id: form.brand_id,
        product_id: form.product_id,
        persona_id: form.persona_id,
        market_id: form.market_id,
        audience_id: form.audience_id
      });

      // Fetch JSON fields from DB
      const { data: brandRow } = form.brand_id
        ? await supabase.from("brands").select("brand_jsonld_object").eq("id", form.brand_id).single()
        : { data: null };
      const { data: productRow } = form.product_id
        ? await supabase.from("products").select("schema_json").eq("id", form.product_id).single()
        : { data: null };
      const { data: personaRow } = form.persona_id
        ? await supabase.from("client_product_persona").select("persona_jsonld").eq("id", form.persona_id).single()
        : { data: null };

      const { error } = await supabase
        .from("client_configuration")
        .upsert({
          auth_user_id: user.id,
          organisation_name: brand?.organisation_name || "",
          brand_id: form.brand_id,
          product_id: form.product_id,
          persona_id: form.persona_id,
          market_id: form.market_id,
          audience_id: form.audience_id,
          brand_name: brand?.brand_name || "",
          product_name: product?.product_name || "",
          persona_name: persona?.persona_name || "",
          market_name: market?.name || "",
          audience_name: audience?.target_audience || "",
          brand_jsonld_object: brandRow?.brand_jsonld_object || null,
          schema_json: productRow?.schema_json || null,
          persona_jsonld: personaRow?.persona_jsonld || null,
        }, { onConflict: "auth_user_id" });

      if (error) {
        console.error('Error saving configuration:', error);
        setMessage("❌ Error: " + error.message);
        return;
      }

      console.log('Configuration saved successfully, calling webhook...');

      // Call the webhook after successful save
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session found');
      }

      console.log('Session token available:', !!session.access_token);
      
      // First, make an OPTIONS request to handle CORS preflight
      console.log('Making CORS preflight request...');
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

      console.log('CORS preflight successful, making POST request...');

      // Then make the actual POST request
      const webhookResponse = await fetch("https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/merge_schedule_and_configuration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "x-client-info": "supabase-js/2.39.3",
          "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        },
        body: JSON.stringify({ auth_user_id: user.id }),
      });

      const responseData = await webhookResponse.json();
      console.log('Webhook response:', {
        status: webhookResponse.status,
        statusText: webhookResponse.statusText,
        data: responseData
      });

      if (!webhookResponse.ok) {
        console.error("Webhook error details:", {
          status: webhookResponse.status,
          statusText: webhookResponse.statusText,
          data: responseData
        });
        setMessage("✅ Configuration saved, but failed to trigger merge function");
        return;
      }

      setMessage("✅ Configuration saved and merge triggered!");
      
      // Wait for 2 seconds to show the success message before redirecting
      await new Promise(resolve => setTimeout(resolve, 2000));
      router.push('/faq-generation-status');
    } catch (error) {
      console.error("Error in form submission:", error);
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          <button
            type="submit"
            className="w-full p-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold transition"
          >
            Save Configuration
          </button>
          {message && <div className="mt-2">{message}</div>}
        </form>
      </div>
    </div>
  );
} 