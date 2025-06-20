'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface FAQPair {
  id: string;
  question: string;
  answer: string;
  batch_id: string;
  created_at: string;
  question_status: string;
  answer_status: string;
  organisation_name?: string;
  industry?: string;
}

interface TestResult {
  question_id: string;
  question: string;
  provider: string;
  response: string;
  response_time_ms: number;
  accuracy_score: number;
  token_usage: number;
  cost_usd: number;
  status: 'success' | 'error' | 'pending';
  error_message?: string;
}

interface TestSummary {
  total_tests: number;
  successful_tests: number;
  total_cost: number;
  total_tokens: number;
  average_accuracy: number;
}

const AI_PROVIDERS = {
  openai: { name: 'OpenAI GPT-4', color: 'from-blue-500 to-blue-600', icon: '🤖' },
  perplexity: { name: 'Perplexity AI', color: 'from-purple-500 to-purple-600', icon: '🔍' },
  gemini: { name: 'Google Gemini', color: 'from-orange-500 to-orange-600', icon: '💎' },
  claude: { name: 'Anthropic Claude', color: 'from-green-500 to-green-600', icon: '🧠' }
};

export default function FAQPerformancePage() {
  const router = useRouter();
  const [faqPairs, setFaqPairs] = useState<FAQPair[]>([]);
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>(['openai']);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testSummary, setTestSummary] = useState<TestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    selected: 0,
    approved: 0
  });

  const loadData = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!user || authError) {
        router.push('/login');
        return;
      }

      // Load FAQ pairs
      const { data, error: fetchError } = await supabase
        .from('review_questions')
        .select(`
          id,
          question,
          ai_response_answers,
          unique_batch_id,
          created_at,
          question_status,
          answer_status,
          organisation,
          organisation_jsonld_object
        `)
        .eq('auth_user_id', user.id)
        .eq('question_status', 'question_approved')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const transformedPairs = data?.map(pair => {
        let orgName = pair.organisation || 'Unknown Organization';
        let industry = 'Unknown Industry';
        
        // Only try to extract industry from JSON-LD if needed
        if (pair.organisation_jsonld_object) {
          try {
            const orgData = typeof pair.organisation_jsonld_object === 'string' 
              ? JSON.parse(pair.organisation_jsonld_object) 
              : pair.organisation_jsonld_object;
            
            // Try multiple possible field names for industry
            industry = orgData.industry || 
                      orgData.sector || 
                      orgData.businessType ||
                      orgData['@industry'] ||
                      orgData['@sector'] ||
                      'Unknown Industry';
          } catch (e) {
            console.error('Error parsing organisation data:', e);
          }
        }

        return {
          id: pair.id,
          question: pair.question,
          answer: pair.ai_response_answers || 'Answer pending...',
          batch_id: pair.unique_batch_id,
          created_at: pair.created_at,
          question_status: pair.question_status,
          answer_status: pair.answer_status,
          organisation_name: orgName,
          industry: industry
        };
      }) || [];

      setFaqPairs(transformedPairs);

      // Calculate stats
      setStats({
        total: transformedPairs.length,
        completed: transformedPairs.filter(p => p.answer_status === 'completed').length,
        selected: selectedPairs.length,
        approved: transformedPairs.filter(p => p.question_status === 'question_approved').length
      });

    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load FAQ pairs');
    } finally {
      setLoading(false);
    }
  }, [router, selectedPairs.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const testFAQPerformance = async () => {
    if (selectedPairs.length === 0) {
      setError('Please select FAQ pairs to test');
      return;
    }

    if (selectedProviders.length === 0) {
      setError('Please select at least one AI provider');
      return;
    }

    setTesting(true);
    setError('');
    setTestResults([]);
    setTestSummary(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session found');

      const response = await fetch('https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/test_faq_performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          auth_user_id: user.id,
          question_ids: selectedPairs,
          ai_providers: selectedProviders,
          test_schedule: 'manual'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run performance test');
      }

      const result = await response.json();
      setTestResults(result.results || []);
      setTestSummary(result.summary || null);

    } catch (error) {
      console.error('Error testing FAQ performance:', error);
      setError(error instanceof Error ? error.message : 'Failed to run performance test');
    } finally {
      setTesting(false);
    }
  };

  const toggleFAQSelection = (faqId: string) => {
    setSelectedPairs(prev => 
      prev.includes(faqId) 
        ? prev.filter(id => id !== faqId)
        : [...prev, faqId]
    );
  };

  const toggleProviderSelection = (provider: string) => {
    setSelectedProviders(prev => 
      prev.includes(provider)
        ? prev.filter(p => p !== provider)
        : [...prev, provider]
    );
  };

  const selectAll = () => {
    setSelectedPairs(faqPairs.map(faq => faq.id));
  };

  const deselectAll = () => {
    setSelectedPairs([]);
  };

  const getProviderColor = (provider: string) => {
    return AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]?.color || 'from-gray-500 to-gray-600';
  };

  const getProviderIcon = (provider: string) => {
    return AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]?.icon || '🤖';
  };

  const getProviderName = (provider: string) => {
    return AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]?.name || provider;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading FAQ Performance Center...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-red-400 mb-2">Error</h2>
            <p className="text-gray-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">FAQ Performance Center</h1>
          <p className="text-xl text-gray-300">Test your FAQ pairs across multiple AI providers and track performance metrics</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total FAQ Pairs</p>
                <p className="text-3xl font-bold text-white">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">New Questions You Can Ask</p>
                <p className="text-3xl font-bold text-white">∞</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Selected for Testing</p>
                <p className="text-3xl font-bold text-white">{stats.selected}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-600/20 to-red-600/20 border border-orange-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">AI Providers</p>
                <p className="text-3xl font-bold text-white">{selectedProviders.length}</p>
              </div>
              <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* AI Provider Selection */}
        <div className="mb-8">
          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Select AI Providers</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(AI_PROVIDERS).map(([key, provider]) => (
                <div
                  key={key}
                  className={`border rounded-xl p-4 transition-all duration-200 ${
                    selectedProviders.includes(key)
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-gray-600 bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes(key)}
                      onChange={() => toggleProviderSelection(key)}
                      className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500 focus:ring-2 cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{provider.icon}</span>
                      <span className="text-white font-medium">{provider.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Test Controls */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-gray-600/50 rounded-xl p-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Deselect All
                </button>
              </div>
              <div className="text-gray-300">
                {selectedPairs.length} FAQ pairs selected • {selectedProviders.length} AI providers
              </div>
              <button
                onClick={testFAQPerformance}
                disabled={testing || selectedPairs.length === 0 || selectedProviders.length === 0}
                className={`px-8 py-3 rounded-xl font-semibold transition-all duration-200 ${
                  testing || selectedPairs.length === 0 || selectedProviders.length === 0
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white transform hover:scale-105'
                }`}
              >
                {testing ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Testing...
                  </div>
                ) : (
                  '🚀 Run Performance Test'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* FAQ Pairs Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Select FAQ Pairs to Test</h2>
          {faqPairs.length === 0 ? (
            <div className="text-center py-16 bg-gray-900/30 border border-gray-700/50 rounded-xl">
              <div className="w-24 h-24 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">No FAQ Pairs Available</h3>
              <p className="text-gray-400 mb-6">You need completed FAQ pairs to run performance tests</p>
              <button
                onClick={() => router.push('/review-questions')}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105"
              >
                Go to Review Questions
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {faqPairs.map((faq) => (
                <div
                  key={faq.id}
                  className={`border rounded-xl p-4 transition-all duration-200 ${
                    selectedPairs.includes(faq.id)
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-gray-600 bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedPairs.includes(faq.id)}
                      onChange={() => toggleFAQSelection(faq.id)}
                      className="mt-1 w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500 focus:ring-2 cursor-pointer"
                    />
                    <div className="flex-1">
                      <h3 className="text-white font-medium mb-2">{faq.question}</h3>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>{faq.organisation_name}</span>
                        <span>•</span>
                        <span>{faq.industry}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Test Results</h2>
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <div key={index} className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-gray-600/50 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        result.status === 'success' 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {result.status === 'success' ? '✅ Success' : '❌ Error'}
                      </span>
                      <span className="text-gray-400 text-sm">{getProviderName(result.provider)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>{result.response_time_ms}ms</span>
                      <span>•</span>
                      <span>{result.token_usage} tokens</span>
                      <span>•</span>
                      <span>${result.cost_usd.toFixed(4)}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-white font-medium mb-2">Question</h4>
                      <p className="text-gray-300 text-sm">{result.question}</p>
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-2">AI Response</h4>
                      <p className="text-gray-300 text-sm">{result.response || 'No response'}</p>
                    </div>
                  </div>

                  {result.error_message && (
                    <div className="mt-4">
                      <h4 className="text-red-400 font-medium mb-2">Error</h4>
                      <p className="text-red-300 text-sm">{result.error_message}</p>
                    </div>
                  )}
                  
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>Accuracy: {result.accuracy_score.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 