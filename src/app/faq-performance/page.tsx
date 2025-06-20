'use client';

import { useEffect, useState } from 'react';
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
  faqId: string;
  question: string;
  expectedAnswer: string;
  apiResponse: string;
  responseTime: number;
  accuracy: number;
  timestamp: string;
  status: 'success' | 'error' | 'pending';
}

export default function FAQPerformancePage() {
  const router = useRouter();
  const [faqPairs, setFaqPairs] = useState<FAQPair[]>([]);
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    approved: 0
  });

  useEffect(() => {
    const loadFAQPairs = async () => {
      try {
        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!user || authError) {
          router.push('/login');
          return;
        }

        // Load FAQ pairs with organization details
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
            organisation_jsonld_object
          `)
          .eq('auth_user_id', user.id)
          .eq('answer_status', 'completed') // Only test completed FAQ pairs
          .order('created_at', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        // Transform the data to include organization details
        const transformedPairs = data?.map(pair => {
          let orgName = 'Unknown Organization';
          let industry = 'Unknown Industry';
          
          if (pair.organisation_jsonld_object) {
            try {
              const orgData = typeof pair.organisation_jsonld_object === 'string' 
                ? JSON.parse(pair.organisation_jsonld_object) 
                : pair.organisation_jsonld_object;
              orgName = orgData.name || orgData.organisation_name || 'Unknown Organization';
              industry = orgData.industry || 'Unknown Industry';
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
        const total = transformedPairs.length;
        const completed = transformedPairs.filter(p => p.answer_status === 'completed').length;
        const pending = transformedPairs.filter(p => p.answer_status !== 'completed').length;
        const approved = transformedPairs.filter(p => p.question_status === 'approved').length;

        setStats({ total, completed, pending, approved });

      } catch (error) {
        console.error('Error loading FAQ pairs:', error);
        setError('Failed to load FAQ pairs');
      } finally {
        setLoading(false);
      }
    };

    loadFAQPairs();
  }, [router]);

  const testFAQPerformance = async () => {
    if (selectedPairs.length === 0) {
      setError('Please select FAQ pairs to test');
      return;
    }

    setTesting(true);
    setError('');
    const newResults: TestResult[] = [];

    for (const faqId of selectedPairs) {
      const faq = faqPairs.find(p => p.id === faqId);
      if (!faq) continue;

      const startTime = Date.now();
      
      try {
        // Call the AI API to test the question
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session found');

        const response = await fetch('https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/ai_request_answers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            question: faq.question,
            organisation_jsonld_object: faq.organisation_name // Simplified for testing
          })
        });

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const result = await response.json();
        const apiResponse = result.answer || 'No response received';

        // Calculate accuracy (simple similarity check)
        const accuracy = calculateSimilarity(faq.answer, apiResponse);

        newResults.push({
          faqId: faq.id,
          question: faq.question,
          expectedAnswer: faq.answer,
          apiResponse,
          responseTime,
          accuracy,
          timestamp: new Date().toISOString(),
          status: 'success'
        });

      } catch (error) {
        const endTime = Date.now();
        newResults.push({
          faqId: faq.id,
          question: faq.question,
          expectedAnswer: faq.answer,
          apiResponse: 'Error occurred during testing',
          responseTime: endTime - startTime,
          accuracy: 0,
          timestamp: new Date().toISOString(),
          status: 'error'
        });
      }
    }

    setTestResults(prev => [...newResults, ...prev]);
    setTesting(false);
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    // Simple similarity calculation - can be enhanced with more sophisticated algorithms
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));
    return (commonWords.length / Math.max(words1.length, words2.length)) * 100;
  };

  const toggleFAQSelection = (faqId: string) => {
    setSelectedPairs(prev => 
      prev.includes(faqId) 
        ? prev.filter(id => id !== faqId)
        : [...prev, faqId]
    );
  };

  const selectAll = () => {
    setSelectedPairs(faqPairs.map(faq => faq.id));
  };

  const deselectAll = () => {
    setSelectedPairs([]);
  };

  const getAverageResponseTime = () => {
    const successfulResults = testResults.filter(r => r.status === 'success');
    if (successfulResults.length === 0) return 0;
    return successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length;
  };

  const getAverageAccuracy = () => {
    const successfulResults = testResults.filter(r => r.status === 'success');
    if (successfulResults.length === 0) return 0;
    return successfulResults.reduce((sum, r) => sum + r.accuracy, 0) / successfulResults.length;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
        </div>
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
          <p className="text-gray-400">Test your FAQ pairs against the AI API to measure performance and accuracy</p>
        </div>

        {/* Performance Stats */}
        {testResults.length > 0 && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Performance Metrics</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <p className="text-gray-400 text-sm">Tests Run</p>
                  <p className="text-2xl font-bold text-white">{testResults.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-sm">Avg Response Time</p>
                  <p className="text-2xl font-bold text-white">{getAverageResponseTime().toFixed(0)}ms</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-sm">Avg Accuracy</p>
                  <p className="text-2xl font-bold text-white">{getAverageAccuracy().toFixed(1)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-sm">Success Rate</p>
                  <p className="text-2xl font-bold text-white">
                    {((testResults.filter(r => r.status === 'success').length / testResults.length) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

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
                {selectedPairs.length} FAQ pairs selected
              </div>
              <button
                onClick={testFAQPerformance}
                disabled={testing || selectedPairs.length === 0}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                  testing || selectedPairs.length === 0
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white transform hover:scale-105'
                }`}
              >
                {testing ? 'Testing...' : 'Run Performance Test'}
              </button>
            </div>
          </div>
        </div>

        {/* FAQ Pairs Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Select FAQ Pairs to Test</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {faqPairs.map((faq) => (
              <div
                key={faq.id}
                className={`border rounded-xl p-4 cursor-pointer transition-all duration-200 ${
                  selectedPairs.includes(faq.id)
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
                }`}
                onClick={() => toggleFAQSelection(faq.id)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedPairs.includes(faq.id)}
                    onChange={() => toggleFAQSelection(faq.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <h3 className="text-white font-medium mb-2">{faq.question}</h3>
                    <p className="text-gray-400 text-sm line-clamp-2">{faq.answer}</p>
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
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Test Results</h2>
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <div key={index} className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-gray-600/50 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Test #{index + 1}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        result.status === 'success' 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {result.status === 'success' ? 'Success' : 'Error'}
                      </span>
                      <span className="text-gray-400 text-sm">{result.responseTime}ms</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-white font-medium mb-2">Question</h4>
                      <p className="text-gray-300 text-sm">{result.question}</p>
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-2">Expected Answer</h4>
                      <p className="text-gray-300 text-sm">{result.expectedAnswer}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <h4 className="text-white font-medium mb-2">API Response</h4>
                    <p className="text-gray-300 text-sm">{result.apiResponse}</p>
                  </div>
                  
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>Accuracy: {result.accuracy.toFixed(1)}%</span>
                      <span>•</span>
                      <span>{new Date(result.timestamp).toLocaleString()}</span>
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