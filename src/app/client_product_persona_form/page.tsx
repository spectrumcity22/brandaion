"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const coreBrandValues = [
  'Innovation', 'Disruption', 'Empathy', 'Excellence', 'Integrity', 'Boldness', 'Sustainability', 'Simplicity'
];
const brandTones = [
  'Friendly, approachable, conversational',
  'Professional, formal, authoritative',
  'Playful, humorous, cheeky',
  'Inspirational, passionate, empowering',
  'Calm, reassuring, supportive',
  'Bold, daring, provocative'
];
const brandArchetypes = [
  'The Hero (bold, achievement-oriented)',
  'The Caregiver (supportive, nurturing)',
  'The Creator (innovative, original)',
  'The Explorer (adventurous, independent)',
  'The Sage (wise, informative)',
  'The Jester (fun, humorous)',
  'The Lover (passionate, expressive)',
  'The Innocent (pure, straightforward)',
  'The Rebel (disruptive, unconventional)'
];
const customerEmotions = [
  'Inspired, motivated', 'Safe, confident', 'Delighted, amused', 'Empowered, capable',
  'Relaxed, reassured', 'Curious, intrigued', 'Understood, cared for'
];
const communicationStyles = [
  'Very casual (conversational, slang-friendly, emoji use encouraged)',
  'Somewhat casual (friendly but polished, limited slang or emoji)',
  'Balanced (professional but conversational, minimal slang or emoji)',
  'Formal (respectful, professional, no slang or emoji)'
];
const brandVoiceHumor = [
  'Very humorous (jokes, memes, playful banter)',
  'Moderately humorous (occasional witty comments)',
  'Balanced (friendly, but humor used sparingly)',
  'Serious (professional, straightforward)'
];
const languageComplexity = [
  'Simple and straightforward (clear, easy-to-understand, minimal jargon)',
  'Balanced (clear but includes some technical terms as needed)',
  'Sophisticated and technical (in-depth explanations, industry-specific language)'
];
const emotionalExpressiveness = [
  'Highly expressive (enthusiastic, energetic, emotional language)',
  'Moderately expressive (balanced emotions with clear information)',
  'Reserved (calm, neutral, fact-focused)'
];
const customerAddressStyles = [
  'Direct and personal (you, first names, informal)',
  'Polite but personable (you, respectful, no first names)',
  'Formal (customers, clients, professional titles)'
];
const brandCommunicationPurpose = [
  'To educate and inform clearly',
  'To entertain and delight',
  'To inspire action and motivate',
  'To build trust and reassurance',
  'To connect and foster community',
  'To challenge conventional thinking'
];
const brandTaglines = [
  'Keeping it simple, smart, and savvy.',
  'Boldly going where no brand has gone before.',
  'Here to help, every step of the way.',
  'Making complicated easy.',
  'Changing the game, one innovation at a time.'
];
const brandVisualMetaphors = [
  'A warm handshake (trustworthy, approachable)',
  'A clever wink (smart, cheeky, friendly)',
  'A megaphone (bold, confident, loud)',
  'A cozy coffee shop (comforting, reassuring, relaxed)',
  'A sleek modern sculpture (stylish, sophisticated, precise)',
  'A playful carnival (fun, lively, inviting)'
];
const languageRegionPreferences = [
  'US English', 'UK English', 'Canadian English', 'Australian English', 'European English', 'Global English (neutral)',
  'Spanish (LATAM)', 'Spanish (Spain)', 'French (France)', 'French (Canada)', 'German', 'Italian', 'Portuguese (Brazil)', 'Arabic', 'Japanese', 'Korean', 'Mandarin Chinese (Simplified)'
];
const competitorVoiceContrasts = [
  'Complex vs. Minimalist', 'Corporate vs. Conversational', 'Detached vs. Empathetic', 'Generic vs. Distinctive',
  'Jargon-heavy vs. Plainspoken', 'Polished vs. Raw/Honest', 'Safe vs. Bold', 'Serious vs. Playful',
  'Slow vs. Decisive', 'Vanilla vs. Mission-driven'
];
const copywriterTypes = [
  'Professional Copywriter', 'Mid Level Copywriter', 'Junior Copywriter', 'Marketing Team', 'PR Team', 'Founder'
];

export default function ClientProductPersonaForm() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [productId, setProductId] = useState('');
  const [organisationName, setOrganisationName] = useState('');
  const [form, setForm] = useState<any>({});
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
      // Fetch products for this user
      const { data: productsData } = await supabase
        .from('products')
        .select('id, product_name, organisation')
        .eq('auth_user_id', user.id);
      setProducts(productsData || []);
      if (productsData && productsData.length > 0) {
        setOrganisationName(productsData[0].organisation || '');
      }
    })();
  }, [router]);

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('Saving...');
    if (!sessionUser || !productId) {
      setMessage('Please select a product.');
      setIsSubmitting(false);
      return;
    }
    const { error } = await supabase
      .from('client_product_persona')
      .insert({
        auth_user_id: sessionUser.id,
        organisation_name: organisationName,
        product_id: productId,
        ...form
      });
    if (error) {
      setMessage('❌ Error saving persona: ' + error.message);
    } else {
      setMessage('✅ Persona saved successfully!');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-8">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg">
        <h2 className="text-xl font-bold mb-4">Create Product Persona</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-400 mb-1">Product</label>
            <select
              value={productId}
              onChange={e => {
                setProductId(e.target.value);
                const selected = products.find(p => p.id === e.target.value);
                setOrganisationName(selected ? selected.organisation : '');
              }}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
              required
            >
              <option value="">Select a product</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.product_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Organisation</label>
            <input
              type="text"
              value={organisationName}
              readOnly
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Persona Name</label>
            <input
              type="text"
              name="persona_name"
              value={form.persona_name || ''}
              onChange={handleChange}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
              placeholder="e.g. UK Brand Voice, Gen Z Playful, etc."
              required
            />
          </div>
          <Dropdown label="Core Brand Value" name="core_brand_value" options={coreBrandValues} value={form.core_brand_value} onChange={handleChange} />
          <Dropdown label="Brand Tone of Voice" name="brand_tone_of_voice" options={brandTones} value={form.brand_tone_of_voice} onChange={handleChange} />
          <Dropdown label="Brand Archetype" name="brand_archetype" options={brandArchetypes} value={form.brand_archetype} onChange={handleChange} />
          <Dropdown label="Customer Emotions" name="customer_emotions" options={customerEmotions} value={form.customer_emotions} onChange={handleChange} />
          <Dropdown label="Communication Style" name="communication_style" options={communicationStyles} value={form.communication_style} onChange={handleChange} />
          <Dropdown label="Brand Voice Humor" name="brand_voice_humor" options={brandVoiceHumor} value={form.brand_voice_humor} onChange={handleChange} />
          <Dropdown label="Language Complexity" name="language_complexity" options={languageComplexity} value={form.language_complexity} onChange={handleChange} />
          <Dropdown label="Emotional Expressiveness" name="emotional_expressiveness" options={emotionalExpressiveness} value={form.emotional_expressiveness} onChange={handleChange} />
          <div>
            <label className="block text-gray-400 mb-1">Words To Avoid</label>
            <input
              type="text"
              name="words_to_avoid"
              value={form.words_to_avoid || ''}
              onChange={handleChange}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
              placeholder="e.g. jargon, slang, negative words, etc."
            />
          </div>
          <Dropdown label="Customer Address Style" name="customer_address_style" options={customerAddressStyles} value={form.customer_address_style} onChange={handleChange} />
          <Dropdown label="Brand Communication Purpose" name="brand_communication_purpose" options={brandCommunicationPurpose} value={form.brand_communication_purpose} onChange={handleChange} />
          <Dropdown label="Brand Tagline" name="brand_tagline" options={brandTaglines} value={form.brand_tagline} onChange={handleChange} />
          <Dropdown label="Brand Visual Metaphor" name="brand_visual_metaphor" options={brandVisualMetaphors} value={form.brand_visual_metaphor} onChange={handleChange} />
          <Dropdown label="Language & Region Preference" name="language_region_preference" options={languageRegionPreferences} value={form.language_region_preference} onChange={handleChange} />
          <Dropdown label="Competitor Voice Contrast" name="competitor_voice_contrast" options={competitorVoiceContrasts} value={form.competitor_voice_contrast} onChange={handleChange} />
          <Dropdown label="Copywriter Type" name="copywriter_type" options={copywriterTypes} value={form.copywriter_type} onChange={handleChange} />
          <div>
            <label className="block text-gray-400 mb-1">Content Do&apos;s &amp; Don&apos;ts</label>
            <textarea
              name="content_dos_and_donts"
              value={form.content_dos_and_donts || ''}
              onChange={handleChange}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
              rows={3}
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 font-bold rounded-lg transition bg-green-500 hover:bg-green-600 text-black"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Persona'}
          </button>
        </form>
        <div className="text-sm mt-4 text-center text-green-400">{message}</div>
      </div>
    </div>
  );
}

function Dropdown({ label, name, options, value, onChange }: any) {
  return (
    <div>
      <label className="block text-gray-400 mb-1">{label}</label>
      <select
        name={name}
        value={value || ''}
        onChange={onChange}
        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
        required
      >
        <option value="">Select...</option>
        {options.map((opt: string) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
} 