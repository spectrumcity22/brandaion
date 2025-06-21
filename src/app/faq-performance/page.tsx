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
    pending: 0,
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
        pending: transformedPairs.filter(p => p.answer_status === 'pending').length,
        approved: transformedPairs.filter(p => p.question_status === 'question_approved').length
      });

    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load FAQ pairs');
    } finally {
      setLoading(false);
    }
  }, [router]);

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
          <h1 className="text-4xl font-bold text-white mb-2">FAQ Performance Testing</h1>
          <p className="text-gray-300 text-lg">Test your FAQ pairs against multiple AI providers to compare performance and accuracy</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-blue-400 text-2xl mr-3">📊</div>
              <div>
                <p className="text-gray-400 text-sm">Total FAQ Pairs</p>
                <p className="text-white text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 border border-green-500/20 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-green-400 text-2xl mr-3">💡</div>
              <div>
                <p className="text-gray-400 text-sm">New Questions You Can Ask</p>
                <p className="text-white text-2xl font-bold">∞</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border border-yellow-500/20 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-yellow-400 text-2xl mr-3">⏳</div>
              <div>
                <p className="text-gray-400 text-sm">Pending Answers</p>
                <p className="text-white text-2xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-purple-400 text-2xl mr-3">🎯</div>
              <div>
                <p className="text-gray-400 text-sm">Ready for Testing</p>
                <p className="text-white text-2xl font-bold">{stats.approved}</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Provider Selection */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Select AI Providers</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(AI_PROVIDERS).map(([key, provider]) => (
              <button
                key={key}
                onClick={() => toggleProviderSelection(key)}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  selectedProviders.includes(key)
                    ? `bg-gradient-to-r ${provider.color} border-transparent text-white`
                    : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="text-2xl mb-2">{provider.icon}</div>
                <div className="text-sm font-medium">{provider.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* FAQ Pairs Selection */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Select FAQ Pairs to Test</h2>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
              >
                Deselect All
              </button>
            </div>
          </div>

          {faqPairs.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-6xl mb-4">📝</div>
              <h3 className="text-xl font-semibold text-white mb-2">No FAQ Pairs Available</h3>
              <p className="text-gray-400">You need approved FAQ pairs to test performance. Generate some FAQ pairs first.</p>
            </div>
          ) : (
            <div className="grid gap-4 max-h-96 overflow-y-auto">
              {faqPairs.map((faq) => (
                <div
                  key={faq.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                    selectedPairs.includes(faq.id)
                      ? 'bg-blue-600/20 border-blue-500'
                      : 'bg-gray-700/30 border-gray-600 hover:border-gray-500'
                  }`}
                  onClick={() => toggleFAQSelection(faq.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-white font-medium mb-2">{faq.question}</h3>
                      <p className="text-gray-300 text-sm mb-2">{faq.answer}</p>
                      <div className="flex gap-4 text-xs text-gray-400">
                        <span>Organization: {faq.organisation_name}</span>
                        <span>Industry: {faq.industry}</span>
                        <span>Created: {new Date(faq.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded border-2 ml-4 ${
                      selectedPairs.includes(faq.id)
                        ? 'bg-blue-500 border-blue-500'
                        : 'border-gray-400'
                    }`}>
                      {selectedPairs.includes(faq.id) && (
                        <div className="text-white text-xs flex items-center justify-center">✓</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Test Button */}
        <div className="text-center mb-8">
          <button
            onClick={testFAQPerformance}
            disabled={testing || selectedPairs.length === 0 || selectedProviders.length === 0}
            className={`px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-200 ${
              testing || selectedPairs.length === 0 || selectedProviders.length === 0
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl'
            }`}
          >
            {testing ? 'Running Tests...' : 'Run Performance Test'}
          </button>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Test Results</h2>
            
            {testSummary && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-4 text-center">
                  <p className="text-blue-400 text-sm">Total Tests</p>
                  <p className="text-white text-2xl font-bold">{testSummary.total_tests}</p>
                </div>
                <div className="bg-green-600/20 border border-green-500/30 rounded-lg p-4 text-center">
                  <p className="text-green-400 text-sm">Successful</p>
                  <p className="text-white text-2xl font-bold">{testSummary.successful_tests}</p>
                </div>
                <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-lg p-4 text-center">
                  <p className="text-yellow-400 text-sm">Total Cost</p>
                  <p className="text-white text-2xl font-bold">${testSummary.total_cost.toFixed(4)}</p>
                </div>
                <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-4 text-center">
                  <p className="text-purple-400 text-sm">Total Tokens</p>
                  <p className="text-white text-2xl font-bold">{testSummary.total_tokens.toLocaleString()}</p>
                </div>
                <div className="bg-orange-600/20 border border-orange-500/30 rounded-lg p-4 text-center">
                  <p className="text-orange-400 text-sm">Avg Accuracy</p>
                  <p className="text-white text-2xl font-bold">{testSummary.average_accuracy.toFixed(1)}%</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {testResults.map((result, index) => (
                <div key={index} className="bg-gray-700/30 border border-gray-600 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${getProviderColor(result.provider)} flex items-center justify-center text-white text-sm font-bold`}>
                        {getProviderIcon(result.provider)}
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{getProviderName(result.provider)}</h3>
                        <p className="text-gray-400 text-sm">Question ID: {result.question_id}</p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      result.status === 'success' ? 'bg-green-600/20 text-green-400' :
                      result.status === 'error' ? 'bg-red-600/20 text-red-400' :
                      'bg-yellow-600/20 text-yellow-400'
                    }`}>
                      {result.status}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Response Time</p>
                      <p className="text-white">{result.response_time_ms}ms</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Accuracy</p>
                      <p className="text-white">{result.accuracy_score.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Tokens Used</p>
                      <p className="text-white">{result.token_usage.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Cost</p>
                      <p className="text-white">${result.cost_usd.toFixed(4)}</p>
                    </div>
                  </div>

                  {result.response && (
                    <div className="mt-3 p-3 bg-gray-600/20 rounded border border-gray-600">
                      <p className="text-gray-400 text-sm mb-1">AI Response:</p>
                      <p className="text-white text-sm">{result.response}</p>
                    </div>
                  )}

                  {result.error_message && (
                    <div className="mt-3 p-3 bg-red-600/20 rounded border border-red-600">
                      <p className="text-red-400 text-sm mb-1">Error:</p>
                      <p className="text-red-300 text-sm">{result.error_message}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 