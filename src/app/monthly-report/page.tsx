'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PerformanceLog {
  id: string;
  question_text: string;
  ai_provider: string;
  accuracy_score: number;
  response_time_ms: number;
  cost_usd: number;
  status: string;
  created_at: string;
  test_schedule: string;
  openai_response?: string;
  gemini_response?: string;
  perplexity_response?: string;
  claude_response?: string;
  openai_accuracy_score?: number;
  gemini_accuracy_score?: number;
  perplexity_accuracy_score?: number;
  claude_accuracy_score?: number;
  openai_cost_usd?: number;
  gemini_cost_usd?: number;
  perplexity_cost_usd?: number;
  claude_cost_usd?: number;
  openai_response_time_ms?: number;
  gemini_response_time_ms?: number;
  perplexity_response_time_ms?: number;
  claude_response_time_ms?: number;
  openai_status?: string;
  gemini_status?: string;
  perplexity_status?: string;
  claude_status?: string;
  tested_llms?: string[];
}

interface MonthlyStats {
  total_tests: number;
  average_accuracy: number;
  average_response_time: number;
  total_cost: number;
  success_rate: number;
}

interface LLMComparison {
  provider: string;
  total_tests: number;
  average_accuracy: number;
  average_response_time: number;
  total_cost: number;
  success_rate: number;
}

const AI_PROVIDERS = {
  openai: { name: 'OpenAI GPT-4', color: 'from-blue-500 to-blue-600', icon: '🤖' },
  perplexity: { name: 'Perplexity AI', color: 'from-purple-500 to-purple-600', icon: '🔍' },
  gemini: { name: 'Google Gemini', color: 'from-orange-500 to-orange-600', icon: '💎' },
  claude: { name: 'Anthropic Claude', color: 'from-green-500 to-green-600', icon: '🧠' }
};

export default function MonthlyReportPage() {
  const router = useRouter();
  const [currentMonthLogs, setCurrentMonthLogs] = useState<PerformanceLog[]>([]);
  const [historicalLogs, setHistoricalLogs] = useState<PerformanceLog[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
  const [llmComparisons, setLlmComparisons] = useState<LLMComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  const loadData = useCallback(async (monthFilter?: string) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!user || authError) {
        router.push('/login');
        return;
      }

      // Get current month (YYYY-MM format)
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
      
      // Set selected month (use filter if provided, otherwise current month)
      const targetMonth = monthFilter || currentMonth;
      setSelectedMonth(targetMonth);

      // Get available months for the dropdown
      const { data: monthData, error: monthError } = await supabase
        .from('faq_performance_logs')
        .select('created_at')
        .eq('auth_user_id', user.id)
        .eq('test_schedule', 'monthly')
        .order('created_at', { ascending: false });

      if (!monthError && monthData) {
        const months = Array.from(new Set(monthData.map(log => 
          new Date(log.created_at).toISOString().slice(0, 7)
        ))).sort().reverse();
        setAvailableMonths(months);
      }

      // Calculate first day of next month for proper date range
      const targetDate = new Date(targetMonth + '-01');
      const nextMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);
      const nextMonthStr = nextMonth.toISOString().slice(0, 7) + '-01';

      // Load selected month's performance logs
      const { data: currentMonthData, error: currentMonthError } = await supabase
        .from('faq_performance_logs')
        .select('*')
        .eq('auth_user_id', user.id)
        .eq('test_schedule', 'monthly')
        .gte('created_at', `${targetMonth}-01`)
        .lt('created_at', nextMonthStr)
        .order('created_at', { ascending: false });

      if (currentMonthError) {
        throw currentMonthError;
      }

      setCurrentMonthLogs(currentMonthData || []);

      // Load historical data (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 7);

      const { data: historicalData, error: historicalError } = await supabase
        .from('faq_performance_logs')
        .select('*')
        .eq('auth_user_id', user.id)
        .eq('test_schedule', 'monthly')
        .gte('created_at', `${sixMonthsAgoStr}-01`)
        .order('created_at', { ascending: false });

      if (historicalError) {
        throw historicalError;
      }

      setHistoricalLogs(historicalData || []);

      // Calculate monthly stats from new data structure
      if (currentMonthData && currentMonthData.length > 0) {
        const totalTests = currentMonthData.length;
        let successfulTests = 0;
        let totalAccuracy = 0;
        let totalResponseTime = 0;
        let totalCost = 0;

        currentMonthData.forEach(log => {
          // Check each provider's status
          if (log.openai_status === 'success') {
            successfulTests++;
            totalAccuracy += log.openai_accuracy_score || 0;
            totalResponseTime += log.openai_response_time_ms || 0;
            totalCost += log.openai_cost_usd || 0;
          }
          if (log.gemini_status === 'success') {
            successfulTests++;
            totalAccuracy += log.gemini_accuracy_score || 0;
            totalResponseTime += log.gemini_response_time_ms || 0;
            totalCost += log.gemini_cost_usd || 0;
          }
          if (log.perplexity_status === 'success') {
            successfulTests++;
            totalAccuracy += log.perplexity_accuracy_score || 0;
            totalResponseTime += log.perplexity_response_time_ms || 0;
            totalCost += log.perplexity_cost_usd || 0;
          }
          if (log.claude_status === 'success') {
            successfulTests++;
            totalAccuracy += log.claude_accuracy_score || 0;
            totalResponseTime += log.claude_response_time_ms || 0;
            totalCost += log.claude_cost_usd || 0;
          }
        });

        const averageAccuracy = successfulTests > 0 ? totalAccuracy / successfulTests : 0;
        const averageResponseTime = successfulTests > 0 ? totalResponseTime / successfulTests : 0;
        const successRate = (successfulTests / totalTests) * 100;

        setMonthlyStats({
          total_tests: totalTests,
          average_accuracy: averageAccuracy,
          average_response_time: averageResponseTime,
          total_cost: totalCost,
          success_rate: successRate
        });

        // Calculate LLM comparisons from new structure
        const llmStats = new Map<string, LLMComparison>();
        
        currentMonthData.forEach(log => {
          // Check each provider
          const providers = ['openai', 'gemini', 'perplexity', 'claude'];
          
          providers.forEach(provider => {
            const status = log[`${provider}_status`];
            if (status === 'success') {
              if (!llmStats.has(provider)) {
                llmStats.set(provider, {
                  provider,
                  total_tests: 0,
                  average_accuracy: 0,
                  average_response_time: 0,
                  total_cost: 0,
                  success_rate: 0
                });
              }
              
              const stats = llmStats.get(provider)!;
              stats.total_tests++;
              stats.average_accuracy += log[`${provider}_accuracy_score`] || 0;
              stats.average_response_time += log[`${provider}_response_time_ms`] || 0;
              stats.total_cost += log[`${provider}_cost_usd`] || 0;
            }
          });
        });

        // Calculate averages
        llmStats.forEach(stats => {
          if (stats.total_tests > 0) {
            stats.average_accuracy = stats.average_accuracy / stats.total_tests;
            stats.average_response_time = stats.average_response_time / stats.total_tests;
            stats.success_rate = 100; // All tests in this calculation were successful
          }
        });

        setLlmComparisons(Array.from(llmStats.values()));
      }

    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMonthChange = (month: string) => {
    setLoading(true);
    loadData(month);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
    }).format(amount);
  };

  const formatTime = (ms: number) => {
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getProviderColor = (provider: string) => {
    return AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]?.color || 'from-gray-500 to-gray-600';
  };

  const getProviderName = (provider: string) => {
    return AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]?.name || provider;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading monthly report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => loadData()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Monthly Performance Report</h1>
          <p className="text-gray-600 mt-2">
            {selectedMonth} - AI Performance Analysis
          </p>
          
          {/* Month Selector */}
          <div className="mt-4 flex items-center space-x-4">
            <label htmlFor="month-select" className="text-sm font-medium text-gray-700">
              Select Month:
            </label>
            <select
              id="month-select"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="block w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {new Date(month + '-01').toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long' 
                  })}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Monthly Stats Overview */}
        {monthlyStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Tests</h3>
              <p className="text-2xl font-bold text-gray-900">{monthlyStats.total_tests}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Average Accuracy</h3>
              <p className="text-2xl font-bold text-green-600">
                {formatPercentage(monthlyStats.average_accuracy)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Avg Response Time</h3>
              <p className="text-2xl font-bold text-blue-600">
                {formatTime(monthlyStats.average_response_time)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Cost</h3>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(monthlyStats.total_cost)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Success Rate</h3>
              <p className="text-2xl font-bold text-green-600">
                {monthlyStats.success_rate.toFixed(1)}%
              </p>
            </div>
          </div>
        )}

        {/* LLM Performance Comparison */}
        {llmComparisons.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">LLM Performance Comparison</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tests
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Accuracy
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Response Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Success Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {llmComparisons.map((comparison) => (
                    <tr key={comparison.provider}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${getProviderColor(comparison.provider)} flex items-center justify-center text-white text-sm font-bold mr-3`}>
                            {AI_PROVIDERS[comparison.provider as keyof typeof AI_PROVIDERS]?.icon || '🤖'}
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {getProviderName(comparison.provider)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {comparison.total_tests}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                        {formatPercentage(comparison.average_accuracy)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                        {formatTime(comparison.average_response_time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                        {formatCurrency(comparison.total_cost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                        {comparison.success_rate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Test Results */}
        {currentMonthLogs.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Recent Test Results</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Question
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Accuracy
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Response Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentMonthLogs.slice(0, 20).map((log) => {
                    // Get the first successful provider for display
                    const providers = ['openai', 'gemini', 'perplexity', 'claude'];
                    let displayProvider = '';
                    let displayAccuracy = 0;
                    let displayResponseTime = 0;
                    let displayCost = 0;
                    let displayStatus = 'pending';

                    for (const provider of providers) {
                      const status = (log as any)[`${provider}_status`];
                      if (status === 'success') {
                        displayProvider = provider;
                        displayAccuracy = (log as any)[`${provider}_accuracy_score`] || 0;
                        displayResponseTime = (log as any)[`${provider}_response_time_ms`] || 0;
                        displayCost = (log as any)[`${provider}_cost_usd`] || 0;
                        displayStatus = status;
                        break;
                      }
                    }

                    // If no successful provider, show the first one with any status
                    if (!displayProvider) {
                      for (const provider of providers) {
                        const status = (log as any)[`${provider}_status`];
                        if (status) {
                          displayProvider = provider;
                          displayAccuracy = (log as any)[`${provider}_accuracy_score`] || 0;
                          displayResponseTime = (log as any)[`${provider}_response_time_ms`] || 0;
                          displayCost = (log as any)[`${provider}_cost_usd`] || 0;
                          displayStatus = status;
                          break;
                        }
                      }
                    }

                    return (
                      <tr key={log.id}>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {log.question_text}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`w-6 h-6 rounded-full bg-gradient-to-r ${getProviderColor(displayProvider)} flex items-center justify-center text-white text-xs font-bold mr-2`}>
                              {AI_PROVIDERS[displayProvider as keyof typeof AI_PROVIDERS]?.icon || '🤖'}
                            </div>
                            <span className="text-sm text-gray-900">
                              {getProviderName(displayProvider)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                          {displayAccuracy > 0 ? formatPercentage(displayAccuracy) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                          {displayResponseTime > 0 ? formatTime(displayResponseTime) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                          {displayCost > 0 ? formatCurrency(displayCost) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            displayStatus === 'success' 
                              ? 'bg-green-100 text-green-800' 
                              : displayStatus === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {displayStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(log.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentMonthLogs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No test results found for this month.</p>
            <p className="text-gray-400 text-sm mt-2">
              Monthly tests will appear here once they are run automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 