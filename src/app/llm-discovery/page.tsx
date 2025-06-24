"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface DiscoveryObject {
  id: string;
  auth_user_id: string;
  client_organisation_id: string;
  organization_jsonld: any;
  brand_jsonld: any;
  product_jsonld: any;
  last_generated: string;
  is_active: boolean;
}

interface FAQObject {
  id: string;
  batch_faq_pairs_id: string;
  auth_user_id: string;
  client_organisation_id: string;
  brand_id: string | null;
  product_id: string | null;
  week_start_date: string;
  faq_json_object: any;
  organization_jsonld: any;
  brand_jsonld: any;
  product_jsonld: any;
  last_generated: string;
}

interface DiscoveryStats {
  total_static_objects: number;
  total_faq_objects: number;
  organizations_with_jsonld: number;
  brands_with_jsonld: number;
  products_with_jsonld: number;
  recent_updates: (DiscoveryObject | FAQObject)[];
}

export default function LLMDiscoveryDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DiscoveryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [regenerationResults, setRegenerationResults] = useState<any>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Get static objects
      const { data: staticObjects, error: staticError } = await supabase
        .from('llm_discovery_static')
        .select('*')
        .eq('auth_user_id', user.id)
        .order('last_generated', { ascending: false });

      if (staticError) throw staticError;

      // Get FAQ objects
      const { data: faqObjects, error: faqError } = await supabase
        .from('llm_discovery_faq_objects')
        .select('*')
        .eq('auth_user_id', user.id)
        .order('last_generated', { ascending: false });

      if (faqError) throw faqError;

      // Calculate stats
      const stats: DiscoveryStats = {
        total_static_objects: staticObjects?.length || 0,
        total_faq_objects: faqObjects?.length || 0,
        organizations_with_jsonld: staticObjects?.filter(obj => obj.organization_jsonld)?.length || 0,
        brands_with_jsonld: staticObjects?.filter(obj => obj.brand_jsonld)?.length || 0,
        products_with_jsonld: staticObjects?.filter(obj => obj.product_jsonld)?.length || 0,
        recent_updates: [...(staticObjects || []), ...(faqObjects || [])]
          .sort((a, b) => new Date(b.last_generated).getTime() - new Date(a.last_generated).getTime())
          .slice(0, 10)
      };

      setStats(stats);

    } catch (err) {
      console.error('Error loading stats:', err);
      setError('Failed to load discovery stats');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateAll = async () => {
    if (!confirm('This will regenerate all LLM discovery objects. This may take a few minutes. Continue?')) {
      return;
    }

    try {
      setRegenerating(true);
      setError('');
      setSuccess('');
      
      const response = await fetch('/api/llm-discovery/regenerate-all', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('All LLM discovery objects regenerated successfully!');
        setRegenerationResults(data.results);
        await loadStats(); // Refresh stats
      } else {
        setError(data.error || 'Failed to regenerate objects');
      }
    } catch (err) {
      console.error('Error regenerating objects:', err);
      setError('Failed to regenerate objects');
    } finally {
      setRegenerating(false);
    }
  };

  const handleRegeneratePlatformIndex = async () => {
    try {
      setError('');
      setSuccess('');
      
      const response = await fetch('/api/llm-discovery/platform-index', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Platform index regenerated successfully!');
        await loadStats(); // Refresh stats
      } else {
        setError(data.error || 'Failed to regenerate platform index');
      }
    } catch (err) {
      console.error('Error regenerating platform index:', err);
      setError('Failed to regenerate platform index');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getObjectTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'static': 'bg-blue-500/20 text-blue-400',
      'faq': 'bg-green-500/20 text-green-400',
    };
    return colors[type] || 'bg-gray-500/20 text-gray-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading LLM Discovery Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">LLM Discovery System</h1>
              <p className="text-gray-400">Manage LLM-friendly discovery objects and JSON-LD structured data</p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-900/20 border border-green-500/50 rounded-lg">
            <p className="text-green-400">{success}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleRegenerateAll}
            disabled={regenerating}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none"
          >
            {regenerating ? 'Regenerating...' : '🔄 Regenerate All Objects'}
          </button>
          
          <button
            onClick={handleRegeneratePlatformIndex}
            className="bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105"
          >
            📋 Regenerate Platform Index
          </button>

          <button
            onClick={() => router.push('/llm-discovery-construction')}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105"
          >
            🚧 Construction Page
          </button>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <div className="text-3xl font-bold text-white mb-2">{stats.total_static_objects}</div>
              <div className="text-gray-400">Static Objects</div>
            </div>
            
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <div className="text-3xl font-bold text-blue-400 mb-2">{stats.total_faq_objects}</div>
              <div className="text-gray-400">FAQ Objects</div>
            </div>
            
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <div className="text-3xl font-bold text-green-400 mb-2">{stats.organizations_with_jsonld}</div>
              <div className="text-gray-400">With Org JSON-LD</div>
            </div>
            
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <div className="text-3xl font-bold text-purple-400 mb-2">{stats.brands_with_jsonld}</div>
              <div className="text-gray-400">With Brand JSON-LD</div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <div className="text-3xl font-bold text-orange-400 mb-2">{stats.products_with_jsonld}</div>
              <div className="text-gray-400">With Product JSON-LD</div>
            </div>
          </div>
        )}

        {/* Recent Updates */}
        {stats && stats.recent_updates.length > 0 && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Recent Updates</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Organization JSON-LD
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Brand JSON-LD
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Product JSON-LD
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Last Generated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {stats.recent_updates.map((obj) => (
                    <tr key={obj.id} className="hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getObjectTypeColor('static' in obj ? 'static' : 'faq')}`}>
                          {'static' in obj ? 'Static' : 'FAQ'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-300 font-mono">{obj.id.slice(0, 8)}...</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={obj.organization_jsonld ? 'text-green-400' : 'text-red-400'}>
                          {obj.organization_jsonld ? '✅' : '❌'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={obj.brand_jsonld ? 'text-green-400' : 'text-red-400'}>
                          {obj.brand_jsonld ? '✅' : '❌'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={obj.product_jsonld ? 'text-green-400' : 'text-red-400'}>
                          {obj.product_jsonld ? '✅' : '❌'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-300">{formatDate(obj.last_generated)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-8 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Quick Links</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/api/llm-discovery/platform-index"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              <span className="text-blue-400">Platform Index</span>
              <span className="text-blue-400">→</span>
            </a>
            
            <a
              href="/api/llm-discovery/organization/brandaion/organization-llms.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-green-500/20 border border-green-500/50 rounded-lg hover:bg-green-500/30 transition-colors"
            >
              <span className="text-green-400">Brandaion Index</span>
              <span className="text-green-400">→</span>
            </a>

            <a
              href="/api/llm-discovery/organization/brandaion/organization.jsonld"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-purple-500/20 border border-purple-500/50 rounded-lg hover:bg-purple-500/30 transition-colors"
            >
              <span className="text-purple-400">Brandaion JSON-LD</span>
              <span className="text-purple-400">→</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
} 