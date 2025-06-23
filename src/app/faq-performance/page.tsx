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
  topic?: string;
}

interface UserStats {
  totalQuestions: number;
  questionsAsked: number;
  questionsRemaining: number;
  totalTopics: number;
  packageTier: string;
  questionsLimit: number;
  llmsLimit: number;
  subscriptionStatus: string;
  nextTestDate: string;
}

interface TopicStats {
  topic: string;
  questionCount: number;
  questions: FAQPair[];
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
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [topicStats, setTopicStats] = useState<TopicStats[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<TopicStats | null>(null);
  const [alreadyAskedQuestions, setAlreadyAskedQuestions] = useState<string[]>([]);

  // Generate last 12 months for filter
  const getMonthOptions = () => {
    const months = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const value = date.toISOString().slice(0, 7);
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      months.push({ value, label });
    }
    return months;
  };

  const loadData = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!user || authError) {
        router.push('/login');
        return;
      }

      // Get user's subscription status and package limits
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .rpc('check_user_subscription_status', { user_id_param: user.id });

      if (subscriptionError) {
        console.error('Subscription check failed:', subscriptionError);
      }

      const subscription = subscriptionData?.[0];
      const packageTier = subscription?.package_tier || 'pack1';
      const subscriptionStatus = subscription?.subscription_status || 'inactive';

      // Get package limits
      const { data: packageLimits, error: limitsError } = await supabase
        .rpc('get_package_limits', { package_tier: packageTier });

      const limits = packageLimits?.[0] || { questions_limit: 5, llms_limit: 1 };

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
          organisation_jsonld_object,
          topic
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
        
        if (pair.organisation_jsonld_object) {
          try {
            const orgData = typeof pair.organisation_jsonld_object === 'string' 
              ? JSON.parse(pair.organisation_jsonld_object) 
              : pair.organisation_jsonld_object;
            
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

        // Use the actual topic from the database instead of extracting from question text
        const topic = pair.topic || 'General';

        return {
          id: pair.id,
          question: pair.question,
          answer: pair.ai_response_answers || 'Answer pending...',
          batch_id: pair.unique_batch_id,
          created_at: pair.created_at,
          question_status: pair.question_status,
          answer_status: pair.answer_status,
          organisation_name: orgName,
          industry: industry,
          topic: topic
        };
      }) || [];

      setFaqPairs(transformedPairs);

      // Load already asked questions for the selected month
      const startDate = new Date(selectedMonth + '-01');
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      
      const { data: askedQuestions, error: askedError } = await supabase
        .from('faq_performance_logs')
        .select('question_id')
        .eq('auth_user_id', user.id)
        .gte('test_date', startDate.toISOString())
        .lte('test_date', endDate.toISOString())
        .eq('test_schedule', 'monthly');

      if (!askedError && askedQuestions) {
        const askedIds = askedQuestions.map(q => q.question_id.toString());
        setAlreadyAskedQuestions(askedIds);
      }

      // Calculate topic statistics
      const topicMap = new Map<string, FAQPair[]>();
      transformedPairs.forEach(pair => {
        const topic = pair.topic || 'General';
        if (!topicMap.has(topic)) {
          topicMap.set(topic, []);
        }
        topicMap.get(topic)!.push(pair);
      });

      const topics = Array.from(topicMap.entries()).map(([topic, questions]) => ({
        topic,
        questionCount: questions.length,
        questions
      }));

      setTopicStats(topics);

      // Calculate user stats
      const questionsAsked = askedQuestions?.length || 0;
      const questionsRemaining = limits.questions_limit - questionsAsked;

      setUserStats({
        totalQuestions: transformedPairs.length,
        questionsAsked: questionsAsked,
        questionsRemaining: questionsRemaining,
        totalTopics: topics.length,
        packageTier: packageTier,
        questionsLimit: limits.questions_limit,
        llmsLimit: limits.llms_limit,
        subscriptionStatus: subscriptionStatus,
        nextTestDate: new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1).toISOString().split('T')[0]
      });

    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load FAQ data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update userStats when selectedPairs changes to show real-time remaining count
  useEffect(() => {
    if (userStats) {
      setUserStats(prev => prev ? {
        ...prev,
        questionsRemaining: Math.max(0, prev.questionsLimit - prev.questionsAsked - selectedPairs.length)
      } : null);
    }
  }, [selectedPairs, userStats]);

  const testFAQPerformance = async () => {
    if (selectedPairs.length === 0) {
      setError('Please select FAQ pairs to test');
      return;
    }

    if (selectedProviders.length === 0) {
      setError('Please select at least one AI provider');
      return;
    }

    if (!userStats) {
      setError('User stats not loaded');
      return;
    }

    // Check if user has exceeded their quota
    if (userStats.questionsRemaining < 0) {
      setError('You have exceeded your monthly quota. Please upgrade your package or wait until next month.');
      return;
    }

    if (selectedPairs.length > userStats.questionsRemaining) {
      setError(`You can only select up to ${userStats.questionsRemaining} more questions for this month`);
      return;
    }

    if (selectedProviders.length > userStats.llmsLimit) {
      setError(`You can only select up to ${userStats.llmsLimit} AI providers for your package`);
      return;
    }

    setTesting(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Step 1: Save selected questions to monthly schedule
      const questionsToInsert = selectedPairs.map(questionId => ({
        user_id: user.id,
        question_id: questionId,
        package_tier: userStats.packageTier,
        is_active: true
      }));

      const { error: questionsError } = await supabase
        .from('user_monthly_questions')
        .upsert(questionsToInsert, { onConflict: 'user_id,question_id' });

      if (questionsError) {
        throw new Error('Failed to save questions to monthly schedule');
      }

      // Step 2: Save selected LLMs to monthly schedule
      const llmsToInsert = selectedProviders.map(provider => ({
        user_id: user.id,
        llm_provider: provider,
        package_tier: userStats.packageTier,
        is_active: true
      }));

      const { error: llmsError } = await supabase
        .from('user_monthly_llms')
        .upsert(llmsToInsert, { onConflict: 'user_id,llm_provider' });

      if (llmsError) {
        throw new Error('Failed to save LLMs to monthly schedule');
      }

      // Step 3: Create or update user monthly schedule
      const { error: scheduleError } = await supabase
        .from('user_monthly_schedule')
        .upsert({
          user_id: user.id,
          package_tier: userStats.packageTier,
          subscription_status: 'active',
          next_test_date: new Date().toISOString().split('T')[0]
        }, { onConflict: 'user_id' });

      if (scheduleError) {
        throw new Error('Failed to create monthly schedule');
      }

      // Step 4: Run immediate test
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session found');

      const response = await fetch('https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/run_question_monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          auth_user_id: user.id,
          question_ids: selectedPairs,
          ai_providers: selectedProviders,
          test_schedule: 'monthly'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Test failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Test completed:', result);

      // Step 5: Redirect to monthly report
      router.push('/monthly-report');
    } catch (error) {
      console.error('Error running test:', error);
      setError(error instanceof Error ? error.message : 'Failed to run test');
    } finally {
      setTesting(false);
    }
  };

  const toggleFAQSelection = (faqId: string) => {
    if (alreadyAskedQuestions.includes(faqId)) {
      setError('This question has already been asked this month');
      return;
    }

    setSelectedPairs(prev => 
      prev.includes(faqId) 
        ? prev.filter(id => id !== faqId)
        : [...prev, faqId]
    );
    setError('');
  };

  const toggleProviderSelection = (provider: string) => {
    setSelectedProviders(prev => 
      prev.includes(provider) 
        ? prev.filter(p => p !== provider)
        : [...prev, provider]
    );
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

  const openTopicModal = (topic: TopicStats) => {
    setSelectedTopic(topic);
    setShowTopicModal(true);
  };

  const closeTopicModal = () => {
    setShowTopicModal(false);
    setSelectedTopic(null);
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center py-32">
        <div className="text-white text-xl">Loading FAQ Performance Dashboard...</div>
      </div>
    );
  }

  if (error && !userStats) {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black">
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
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">FAQ Performance Dashboard</h1>
            <p className="text-xl text-gray-300">Monitor and test your FAQ performance across AI providers</p>
          </div>
          <div className="mt-4 md:mt-0 flex gap-4">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-gray-800/50 border border-gray-600 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {getMonthOptions().map(month => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => router.push('/monthly-report')}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              📊 Monthly Report
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      {userStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Package Limit</p>
                <p className="text-3xl font-bold text-white">{userStats.questionsLimit}</p>
                <p className="text-xs text-gray-500">questions/month</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className={`bg-gradient-to-br ${userStats.questionsRemaining < 0 ? 'from-red-600/20 to-pink-600/20 border-red-500/30' : 'from-green-600/20 to-emerald-600/20 border-green-500/30'} border rounded-xl p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Questions Remaining</p>
                <p className={`text-3xl font-bold ${userStats.questionsRemaining < 0 ? 'text-red-400' : 'text-white'}`}>
                  {userStats.questionsRemaining}
                </p>
                <p className="text-xs text-gray-500">of {userStats.questionsLimit} limit</p>
              </div>
              <div className={`w-12 h-12 ${userStats.questionsRemaining < 0 ? 'bg-red-500/20' : 'bg-green-500/20'} rounded-lg flex items-center justify-center`}>
                {userStats.questionsRemaining < 0 ? (
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Topics</p>
                <p className="text-3xl font-bold text-white">{userStats.totalTopics}</p>
                <p className="text-xs text-gray-500">categories</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-600/20 to-red-600/20 border border-orange-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Subscription</p>
                <p className={`text-2xl font-bold ${userStats.subscriptionStatus === 'active' ? 'text-green-400' : 'text-red-400'}`}>
                  {userStats.subscriptionStatus === 'active' ? 'Active' : 'Inactive'}
                </p>
                <p className="text-xs text-gray-500">{userStats.packageTier}</p>
              </div>
              <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    disabled={selectedProviders.length >= (userStats?.llmsLimit || 1) && !selectedProviders.includes(key)}
                    className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500 focus:ring-2 cursor-pointer disabled:opacity-50"
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
            <div className="text-gray-300">
              {selectedPairs.length} FAQ pairs selected • {selectedProviders.length} AI providers
              {userStats && userStats.questionsRemaining < 0 && (
                <span className="ml-4 text-red-400 font-semibold">⚠️ Monthly quota exceeded!</span>
              )}
            </div>
            <button
              onClick={testFAQPerformance}
              disabled={testing || selectedPairs.length === 0 || selectedProviders.length === 0 || (userStats?.questionsRemaining || 0) < 0}
              className={`px-8 py-3 rounded-xl font-semibold transition-all duration-200 ${
                testing || selectedPairs.length === 0 || selectedProviders.length === 0 || (userStats?.questionsRemaining || 0) < 0
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white transform hover:scale-105'
              }`}
            >
              {testing ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Running Test...
                </div>
              ) : (
                '📅 Run Test'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* FAQ Pairs Selection */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Select FAQ Pairs for Monthly Monitoring</h2>
        {faqPairs.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/30 border border-gray-700/50 rounded-xl">
            <div className="w-24 h-24 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">No FAQ Pairs Available</h3>
            <p className="text-gray-400 mb-6">You need completed FAQ pairs to set up monthly monitoring</p>
            <button
              onClick={() => router.push('/review-questions')}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105"
            >
              Go to Review Questions
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {faqPairs.map((faq) => {
              const isAlreadyAsked = alreadyAskedQuestions.includes(faq.id);
              const isSelected = selectedPairs.includes(faq.id);
              
              return (
                <div
                  key={faq.id}
                  className={`border rounded-xl p-4 transition-all duration-200 relative ${
                    isAlreadyAsked
                      ? 'border-yellow-500 bg-yellow-500/10'
                      : isSelected
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-gray-600 bg-gray-800/50'
                  }`}
                >
                  {/* Already Asked Badge */}
                  {isAlreadyAsked && (
                    <div className="absolute -top-2 -right-2 bg-yellow-500 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">
                      ✓ Asked
                    </div>
                  )}
                  
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleFAQSelection(faq.id)}
                      disabled={isAlreadyAsked}
                      className="mt-1 w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500 focus:ring-2 cursor-pointer disabled:opacity-50"
                    />
                    <div className="flex-1">
                      <h3 className="text-white font-medium mb-2">{faq.question}</h3>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>{faq.organisation_name}</span>
                        <span>•</span>
                        <span className="text-blue-400 font-medium">{faq.topic}</span>
                        {isAlreadyAsked && (
                          <>
                            <span>•</span>
                            <span className="text-yellow-400 font-semibold">Already asked this month</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Topics Overview - Moved below questions */}
      <div className="mb-8">
        <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Topics Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topicStats.map((topic) => (
              <div
                key={topic.topic}
                className="bg-gray-800/50 border border-gray-600 rounded-xl p-4 cursor-pointer hover:border-blue-500/50 transition-all duration-200"
                onClick={() => openTopicModal(topic)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">{topic.topic}</h3>
                    <p className="text-gray-400 text-sm">{topic.questionCount} questions</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Topic Modal */}
    {showTopicModal && selectedTopic && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">{selectedTopic.topic}</h2>
              <button
                onClick={closeTopicModal}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-gray-400 mt-2">{selectedTopic.questionCount} questions in this topic</p>
          </div>
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            <div className="space-y-4">
              {selectedTopic.questions.map((question) => {
                const isAlreadyAsked = alreadyAskedQuestions.includes(question.id);
                return (
                  <div 
                    key={question.id} 
                    className={`border rounded-lg p-4 relative ${
                      isAlreadyAsked 
                        ? 'bg-yellow-500/10 border-yellow-500/50' 
                        : 'bg-gray-800/50 border-gray-600'
                    }`}
                  >
                    {isAlreadyAsked && (
                      <div className="absolute -top-2 -right-2 bg-yellow-500 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">
                        ✓ Asked
                      </div>
                    )}
                    <h3 className="text-white font-medium mb-2">{question.question}</h3>
                    <p className="text-gray-400 text-sm mb-2">{question.answer}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{question.organisation_name}</span>
                      <span>•</span>
                      <span>{question.industry}</span>
                      {isAlreadyAsked && (
                        <>
                          <span>•</span>
                          <span className="text-yellow-400 font-semibold">Already asked this month</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
); }
