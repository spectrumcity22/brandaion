"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Persona {
  id: string;
  auth_user_id: string;
  organisation_name: string;
  persona_name: string;
  core_brand_value: string;
  brand_archetype: string;
  language_complexity: string;
  emotional_expressiveness: string;
  brand_tone_of_voice: string;
  brand_voice_humor: string;
  communication_style: string;
  customer_address_style: string;
  brand_communication_purpose: string;
  brand_tagline: string;
  brand_visual_metaphor: string;
  competitor_voice_contrast: string;
  copywriter_type: string;
  language_region_preference: string;
  words_to_avoid: string;
  content_dos_and_donts: string;
  created_at?: string;
  updated_at?: string;
}

interface Organisation {
  id: string;
  organisation_name: string;
  auth_user_id: string;
}

interface SubscriptionInfo {
  package_tier: string;
  status: string;
}

const coreBrandValues = [
  'Innovation', 'Disruption', 'Empathy', 'Excellence', 'Integrity', 'Boldness', 'Sustainability', 'Simplicity'
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

const brandTones = [
  'Friendly, approachable, conversational',
  'Professional, formal, authoritative',
  'Playful, humorous, cheeky',
  'Inspirational, passionate, empowering',
  'Calm, reassuring, supportive',
  'Bold, daring, provocative'
];

const brandVoiceHumor = [
  'Very humorous (jokes, memes, playful banter)',
  'Moderately humorous (occasional witty comments)',
  'Balanced (friendly, but humor used sparingly)',
  'Serious (professional, straightforward)'
];

const communicationStyles = [
  'Very casual (conversational, slang-friendly, emoji use encouraged)',
  'Somewhat casual (friendly but polished, limited slang or emoji)',
  'Balanced (professional but conversational, minimal slang or emoji)',
  'Formal (respectful, professional, no slang or emoji)'
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

const competitorVoiceContrasts = [
  'Complex vs. Minimalist', 'Corporate vs. Conversational', 'Detached vs. Empathetic', 'Generic vs. Distinctive',
  'Jargon-heavy vs. Plainspoken', 'Polished vs. Raw/Honest', 'Safe vs. Bold', 'Serious vs. Playful',
  'Slow vs. Decisive', 'Vanilla vs. Mission-driven'
];

const copywriterTypes = [
  'Professional Copywriter', 'Mid Level Copywriter', 'Junior Copywriter', 'Marketing Team', 'PR Team', 'Founder'
];

const languageRegionPreferences = [
  'US English', 'UK English', 'Canadian English', 'Australian English', 'European English', 'Global English (neutral)',
  'Spanish (LATAM)', 'Spanish (Spain)', 'French (France)', 'French (Canada)', 'German', 'Italian', 'Portuguese (Brazil)', 'Arabic', 'Japanese', 'Korean', 'Mandarin Chinese (Simplified)'
];

export default function ClientPersonas() {
  const router = useRouter();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [formData, setFormData] = useState<Partial<Persona>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!user || authError) {
        router.push('/login');
        return;
      }

      // Fetch all personas for this user
      const { data: personasData, error: personasError } = await supabase
        .from('client_product_persona')
        .select('*')
        .eq('auth_user_id', user.id)
        .order('created_at', { ascending: false });

      if (personasError) {
        setError('Failed to load personas.');
      } else {
        console.log('Loaded personas:', personasData);
        setPersonas(personasData || []);
      }

      // Fetch organisations for this user
      const { data: orgsData, error: orgsError } = await supabase
        .from('client_organisation')
        .select('id, organisation_name, auth_user_id')
        .eq('auth_user_id', user.id);

      if (orgsError) {
        setError('Failed to load organisations.');
      } else {
        setOrganisations(orgsData || []);
      }

      // Load subscription info
      const { data: subscriptionData } = await supabase
        .from('invoices')
        .select('package_tier')
        .eq('auth_user_id', user.id)
        .order('inserted_at', { ascending: false })
        .limit(1);

      if (subscriptionData?.[0]) {
        setSubscription({
          package_tier: subscriptionData[0].package_tier,
          status: 'active'
        });
      } else {
        setSubscription({
          package_tier: 'startup',
          status: 'inactive'
        });
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data.');
      setLoading(false);
    }
  };

  const getPackageLimits = (packageTier: string) => {
    switch (packageTier?.toLowerCase()) {
      case 'startup':
      case 'pack1':
        return { name: 'Startup', limit: 1 };
      case 'growth':
      case 'pack2':
        return { name: 'Growth', limit: 3 };
      case 'pro':
      case 'pack3':
        return { name: 'Pro', limit: 5 };
      case 'enterprise':
      case 'pack4':
        return { name: 'Enterprise', limit: Infinity };
      default:
        return { name: 'Startup', limit: 1 };
    }
  };

  const getPackageIcon = (packageTier: string) => {
    switch (packageTier?.toLowerCase()) {
      case 'startup':
      case 'pack1':
        return '🚀';
      case 'growth':
      case 'pack2':
        return '📈';
      case 'pro':
      case 'pack3':
        return '💎';
      case 'enterprise':
      case 'pack4':
        return '👑';
      default:
        return '📦';
    }
  };

  const canCreatePersona = () => {
    const packageInfo = getPackageLimits(subscription?.package_tier || 'startup');
    return personas.length < packageInfo.limit;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('User not authenticated.');
      return;
    }

    if (!formData.persona_name?.trim()) {
      setError('Persona name is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (editingPersona) {
        // Update existing persona
        const { error: updateError } = await supabase
          .from('client_product_persona')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingPersona.id);

        if (updateError) throw updateError;
        setSuccess('Persona updated successfully!');
      } else {
        // Create new persona
        const { error: insertError } = await supabase
          .from('client_product_persona')
          .insert({
            ...formData,
            auth_user_id: user.id,
            organisation_name: organisations[0]?.organisation_name || ''
          });

        if (insertError) throw insertError;
        setSuccess('Persona created successfully!');
      }

      // Reload data
      await loadData();
      setShowForm(false);
      setEditingPersona(null);
      setFormData({});
    } catch (err: any) {
      setError(err.message || 'Failed to save persona.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (persona: Persona) => {
    setEditingPersona(persona);
    setFormData(persona);
    setShowForm(true);
  };

  const handleDelete = async (personaId: string) => {
    if (!confirm('Are you sure you want to delete this persona?')) return;

    try {
      const { error } = await supabase
        .from('client_product_persona')
        .delete()
        .eq('id', personaId);

      if (error) throw error;
      await loadData();
      setSuccess('Persona deleted successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to delete persona.');
    }
  };

  const handleNewPersona = () => {
    setEditingPersona(null);
    setFormData({});
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingPersona(null);
    setFormData({});
    setError('');
    setSuccess(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="glass-card p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading personas...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="glass-card p-8 text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 shimmer-text">Persona Management</h1>
          <p className="text-gray-400">Define your brand voice and personality for AI-powered content generation</p>
        </div>

        {/* Package Limits Panel */}
        <div className="glass-card p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-2xl">{getPackageIcon(subscription?.package_tier || 'startup')}</div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {getPackageLimits(subscription?.package_tier || 'startup').name} Plan
                </h3>
                <p className="text-gray-400 text-sm">
                  {personas.length} of {getPackageLimits(subscription?.package_tier || 'startup').limit === Infinity ? '∞' : getPackageLimits(subscription?.package_tier || 'startup').limit} personas used
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              {canCreatePersona() && (
                <button
                  onClick={handleNewPersona}
                  className="premium-button"
                >
                  Create Persona
                </button>
              )}
              {!canCreatePersona() && (
                <button
                  onClick={() => router.push('/packages')}
                  className="premium-button"
                >
                  Upgrade Plan
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="glass-card p-4 mb-6 bg-red-500/10 text-red-400 border border-red-500/20">
            {error}
          </div>
        )}
        {success && (
          <div className="glass-card p-4 mb-6 bg-green-500/10 text-green-400 border border-green-500/20">
            {success}
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="glass-card p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6">
              {editingPersona ? 'Edit Persona' : 'Create New Persona'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Persona Name
                </label>
                <input
                  type="text"
                  name="persona_name"
                  value={formData.persona_name || ''}
                  onChange={handleChange}
                  className="glass-input w-full p-4"
                  placeholder="e.g. UK Brand Voice, Gen Z Playful, etc."
                  required
                />
              </div>

              {/* How We Think */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-white mb-4 border-b border-gray-600 pb-2">
                  How We Think
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <Dropdown 
                    label="Core Brand Value" 
                    name="core_brand_value" 
                    options={coreBrandValues} 
                    value={formData.core_brand_value || ''} 
                    onChange={handleChange}
                    description="The fundamental principle that drives your brand's decisions and actions"
                  />

                  <Dropdown 
                    label="Brand Archetype" 
                    name="brand_archetype" 
                    options={brandArchetypes} 
                    value={formData.brand_archetype || ''} 
                    onChange={handleChange}
                    description="The personality pattern that defines your brand's character and behavior"
                  />

                  <Dropdown 
                    label="Language Complexity" 
                    name="language_complexity" 
                    options={languageComplexity} 
                    value={formData.language_complexity || ''} 
                    onChange={handleChange}
                    description="How sophisticated or simple your communication style should be"
                  />

                  <Dropdown 
                    label="Emotional Expressiveness" 
                    name="emotional_expressiveness" 
                    options={emotionalExpressiveness} 
                    value={formData.emotional_expressiveness || ''} 
                    onChange={handleChange}
                    description="How much emotion and personality to show in your communications"
                  />
                </div>
              </div>

              {/* How We Respond */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-white mb-4 border-b border-gray-600 pb-2">
                  How We Respond
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <Dropdown 
                    label="Brand Tone of Voice" 
                    name="brand_tone_of_voice" 
                    options={brandTones} 
                    value={formData.brand_tone_of_voice || ''} 
                    onChange={handleChange}
                    description="The overall attitude and personality in your brand's communication"
                  />

                  <Dropdown 
                    label="Brand Voice Humor" 
                    name="brand_voice_humor" 
                    options={brandVoiceHumor} 
                    value={formData.brand_voice_humor || ''} 
                    onChange={handleChange}
                    description="How much humor and playfulness to include in your content"
                  />

                  <Dropdown 
                    label="Communication Style" 
                    name="communication_style" 
                    options={communicationStyles} 
                    value={formData.communication_style || ''} 
                    onChange={handleChange}
                    description="The level of formality and casualness in your messaging"
                  />

                  <Dropdown 
                    label="Customer Address Style" 
                    name="customer_address_style" 
                    options={customerAddressStyles} 
                    value={formData.customer_address_style || ''} 
                    onChange={handleChange}
                    description="How you refer to and interact with your customers"
                  />
                </div>
              </div>

              {/* How We Differentiate Ourselves */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-white mb-4 border-b border-gray-600 pb-2">
                  How We Differentiate Ourselves
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <Dropdown 
                    label="Brand Communication Purpose" 
                    name="brand_communication_purpose" 
                    options={brandCommunicationPurpose} 
                    value={formData.brand_communication_purpose || ''} 
                    onChange={handleChange}
                    description="The primary goal of your brand's communication efforts"
                  />

                  <Dropdown 
                    label="Brand Tagline" 
                    name="brand_tagline" 
                    options={brandTaglines} 
                    value={formData.brand_tagline || ''} 
                    onChange={handleChange}
                    description="A short, memorable phrase that captures your brand essence"
                  />

                  <Dropdown 
                    label="Brand Visual Metaphor" 
                    name="brand_visual_metaphor" 
                    options={brandVisualMetaphors} 
                    value={formData.brand_visual_metaphor || ''} 
                    onChange={handleChange}
                    description="A visual concept that represents your brand's personality"
                  />

                  <Dropdown 
                    label="Competitor Voice Contrast" 
                    name="competitor_voice_contrast" 
                    options={competitorVoiceContrasts} 
                    value={formData.competitor_voice_contrast || ''} 
                    onChange={handleChange}
                    description="How your voice differs from competitors in your market"
                  />
                </div>
              </div>

              {/* Our Copywriting Style */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-white mb-4 border-b border-gray-600 pb-2">
                  Our Copywriting Style
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <Dropdown 
                    label="Copywriter Type" 
                    name="copywriter_type" 
                    options={copywriterTypes} 
                    value={formData.copywriter_type || ''} 
                    onChange={handleChange}
                    description="The level of expertise and style of your writing team"
                  />

                  <Dropdown 
                    label="Language & Region Preference" 
                    name="language_region_preference" 
                    options={languageRegionPreferences} 
                    value={formData.language_region_preference || ''} 
                    onChange={handleChange}
                    description="The specific language variant and regional preferences for your content"
                  />

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Words To Avoid
                    </label>
                    <input
                      type="text"
                      name="words_to_avoid"
                      value={formData.words_to_avoid || ''}
                      onChange={handleChange}
                      className="glass-input w-full p-4"
                      placeholder="e.g. jargon, slang, negative words, etc."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Terms that don&apos;t align with your brand voice or should be avoided
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Content Do&apos;s &amp; Don&apos;ts
                    </label>
                    <textarea
                      name="content_dos_and_donts"
                      value={formData.content_dos_and_donts || ''}
                      onChange={handleChange}
                      className="glass-input w-full p-4 h-24 resize-none"
                      placeholder="List specific do&apos;s and don&apos;ts for your content..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Specific guidelines for what to include or avoid in your content
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="submit"
                  disabled={saving}
                  className={`premium-button flex-1 ${saving ? 'premium-loading' : ''}`}
                >
                  {saving ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
                      {editingPersona ? 'Updating Persona...' : 'Creating Persona...'}
                    </div>
                  ) : (
                    `Save Persona`
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={handleCancel}
                  className="glass-input p-4 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Personas Cards */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Your Personas</h2>
          </div>
          
          {personas.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-gray-400 mb-4">No personas found. Create your first persona to get started.</p>
              <button
                onClick={handleNewPersona}
                disabled={!canCreatePersona()}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  canCreatePersona() 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {canCreatePersona() ? 'Create Your First Persona' : 'Persona Limit Reached'}
              </button>
            </div>
          ) : (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {personas.map((persona) => {
                  return (
                    <div key={persona.id} className="bg-gray-800/30 border border-gray-600/30 rounded-xl p-4 hover:border-gray-500/50 transition-all duration-200">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="w-12 h-12 rounded-full bg-gray-700/50 border border-gray-600/50 flex items-center justify-center text-lg font-semibold text-gray-300">
                            {persona.persona_name?.charAt(0)?.toUpperCase() || 'P'}
                          </div>
                          <h4 className="text-lg font-semibold text-white truncate">{persona.persona_name}</h4>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(persona)}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                            title="Edit Persona"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(persona.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            title="Delete Persona"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <p className="text-gray-400 text-sm">Organisation</p>
                          <p className="text-white text-sm font-medium">{persona.organisation_name}</p>
                        </div>
                        
                        <div>
                          <p className="text-gray-400 text-sm">Core Value</p>
                          <p className="text-white text-sm">{persona.core_brand_value || 'Not set'}</p>
                        </div>
                        
                        <div>
                          <p className="text-gray-400 text-sm">Archetype</p>
                          <p className="text-white text-sm">{persona.brand_archetype || 'Not set'}</p>
                        </div>
                        
                        <div>
                          <p className="text-gray-400 text-sm">Created</p>
                          <p className="text-white text-sm">
                            {persona.created_at ? new Date(persona.created_at).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Upgrade Cards to fill empty slots */}
                {(() => {
                  const currentPersonaCount = personas.length;
                  const limits = subscription ? getPackageLimits(subscription.package_tier) : { limit: 0 };
                  const maxPersonas = limits.limit === Infinity ? 999 : limits.limit;
                  const emptySlots = Math.max(0, 3 - (currentPersonaCount % 3));
                  
                  if (currentPersonaCount >= maxPersonas && emptySlots > 0) {
                    return Array.from({ length: emptySlots }, (_, index) => (
                      <div key={`upgrade-${index}`} className="relative bg-gray-800/30 backdrop-blur-sm border border-gray-600/30 rounded-xl p-4 overflow-hidden">
                        {/* Blurred overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10 backdrop-blur-sm"></div>
                        
                        {/* Content */}
                        <div className="relative z-10 text-center py-6">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                          <h4 className="text-lg font-semibold text-white mb-2">Upgrade Your Plan</h4>
                          <p className="text-gray-400 text-sm mb-3">Unlock more personas and features</p>
                          <button
                            onClick={() => router.push('/packages')}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 text-sm"
                          >
                            View Plans
                          </button>
                        </div>
                      </div>
                    ));
                  }
                  return null;
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Dropdown({ label, name, options, value, onChange, description }: any) {
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
      {description && (
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      )}
    </div>
  );
} 