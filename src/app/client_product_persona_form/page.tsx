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
      
      // Get organisation name from client_organisation
      const { data: orgData } = await supabase
        .from('client_organisation')
        .select('organisation_name')
        .eq('auth_user_id', user.id)
        .single();
      
      if (orgData) {
        setOrganisationName(orgData.organisation_name || '');
      }
    })();
  }, [router]);

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('Saving persona...');
    
    if (!sessionUser) {
      setMessage('Please log in.');
      setIsSubmitting(false);
      return;
    }
    
    const { error } = await supabase
      .from('client_product_persona')
      .insert({
        auth_user_id: sessionUser.id,
        organisation_name: organisationName,
        ...form
      });
    
    if (error) {
      setMessage('❌ Error saving persona: ' + error.message);
      setIsSubmitting(false);
    } else {
      setMessage('✅ Persona saved successfully! Redirecting to next step...');
      
      // Redirect to schedule page (next step in the flow)
      setTimeout(() => {
        router.push('/schedule');
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="glass-card p-8 text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full premium-gradient flex items-center justify-center text-2xl glow-animation">
            🎭
          </div>
          <h1 className="text-3xl font-bold mb-2 shimmer-text">Create Persona</h1>
          <p className="text-gray-400">Define your brand voice and personality for AI-powered FAQ generation</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="glass-card p-8">
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
                  🏢 Organisation
                </label>
                <input
                  type="text"
                  value={organisationName}
                  readOnly
                  className="glass-input w-full p-4 text-gray-400"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  🎭 Persona Name
                </label>
                <input
                  type="text"
                  name="persona_name"
                  value={form.persona_name || ''}
                  onChange={handleChange}
                  className="glass-input w-full p-4"
                  placeholder="e.g. UK Brand Voice, Gen Z Playful, etc."
                  required
                />
              </div>

              <Dropdown 
                label="💎 Core Brand Value" 
                name="core_brand_value" 
                options={coreBrandValues} 
                value={form.core_brand_value || ''} 
                onChange={handleChange} 
              />

              <Dropdown 
                label="🎵 Brand Tone of Voice" 
                name="brand_tone_of_voice" 
                options={brandTones} 
                value={form.brand_tone_of_voice || ''} 
                onChange={handleChange} 
              />

              <Dropdown 
                label="🦸 Brand Archetype" 
                name="brand_archetype" 
                options={brandArchetypes} 
                value={form.brand_archetype || ''} 
                onChange={handleChange} 
              />

              <Dropdown 
                label="💝 Customer Emotions" 
                name="customer_emotions" 
                options={customerEmotions} 
                value={form.customer_emotions || ''} 
                onChange={handleChange} 
              />

              <Dropdown 
                label="💬 Communication Style" 
                name="communication_style" 
                options={communicationStyles} 
                value={form.communication_style || ''} 
                onChange={handleChange} 
              />

              <Dropdown 
                label="😄 Brand Voice Humor" 
                name="brand_voice_humor" 
                options={brandVoiceHumor} 
                value={form.brand_voice_humor || ''} 
                onChange={handleChange} 
              />

              <Dropdown 
                label="📚 Language Complexity" 
                name="language_complexity" 
                options={languageComplexity} 
                value={form.language_complexity || ''} 
                onChange={handleChange} 
              />

              <Dropdown 
                label="🎭 Emotional Expressiveness" 
                name="emotional_expressiveness" 
                options={emotionalExpressiveness} 
                value={form.emotional_expressiveness || ''} 
                onChange={handleChange} 
              />

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  🚫 Words To Avoid
                </label>
                <input
                  type="text"
                  name="words_to_avoid"
                  value={form.words_to_avoid || ''}
                  onChange={handleChange}
                  className="glass-input w-full p-4"
                  placeholder="e.g. jargon, slang, negative words, etc."
                />
              </div>

              <Dropdown 
                label="👋 Customer Address Style" 
                name="customer_address_style" 
                options={customerAddressStyles} 
                value={form.customer_address_style || ''} 
                onChange={handleChange} 
              />

              <Dropdown 
                label="🎯 Brand Communication Purpose" 
                name="brand_communication_purpose" 
                options={brandCommunicationPurpose} 
                value={form.brand_communication_purpose || ''} 
                onChange={handleChange} 
              />

              <Dropdown 
                label="🏷️ Brand Tagline" 
                name="brand_tagline" 
                options={brandTaglines} 
                value={form.brand_tagline || ''} 
                onChange={handleChange} 
              />

              <Dropdown 
                label="🎨 Brand Visual Metaphor" 
                name="brand_visual_metaphor" 
                options={brandVisualMetaphors} 
                value={form.brand_visual_metaphor || ''} 
                onChange={handleChange} 
              />

              <Dropdown 
                label="🌍 Language & Region Preference" 
                name="language_region_preference" 
                options={languageRegionPreferences} 
                value={form.language_region_preference || ''} 
                onChange={handleChange} 
              />

              <Dropdown 
                label="⚔️ Competitor Voice Contrast" 
                name="competitor_voice_contrast" 
                options={competitorVoiceContrasts} 
                value={form.competitor_voice_contrast || ''} 
                onChange={handleChange} 
              />

              <Dropdown 
                label="✍️ Copywriter Type" 
                name="copywriter_type" 
                options={copywriterTypes} 
                value={form.copywriter_type || ''} 
                onChange={handleChange} 
              />

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  📝 Content Do&apos;s &amp; Don&apos;ts
                </label>
                <textarea
                  name="content_dos_and_donts"
                  value={form.content_dos_and_donts || ''}
                  onChange={handleChange}
                  className="glass-input w-full p-4 h-24 resize-none"
                  placeholder="List specific do&apos;s and don&apos;ts for your content..."
                />
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`premium-button flex-1 ${isSubmitting ? 'premium-loading' : ''}`}
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
                    Saving Persona...
                  </div>
                ) : (
                  '✨ Save Persona'
                )}
              </button>
              
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="glass-input p-4 hover:bg-white/10 transition-colors"
              >
                🏠 Back to Dashboard
              </button>
            </div>
          </div>
        </form>

        {/* Help Section */}
        <div className="glass-card p-8 mt-8">
          <h2 className="text-2xl font-bold mb-6">💡 Persona Creation Tips</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="font-semibold mb-2">Be Specific</h3>
              <p className="text-gray-400 text-sm">Choose options that truly reflect your brand&apos;s personality</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">🔄</div>
              <h3 className="font-semibold mb-2">Iterate & Refine</h3>
              <p className="text-gray-400 text-sm">You can always update your persona as your brand evolves</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">📈</div>
              <h3 className="font-semibold mb-2">Better Results</h3>
              <p className="text-gray-400 text-sm">Detailed personas lead to more accurate and engaging FAQs</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dropdown({ label, name, options, value, onChange }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="glass-input w-full p-4"
      >
        <option value="">Select an option</option>
        {options.map((option: string, index: number) => (
          <option key={index} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
} 