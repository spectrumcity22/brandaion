'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface DashboardData {
  user: any;
  invoice: any;
  endUser: any;
  organisation: any;
  brands: any[];
  personas: any[];
  products: any[];
  configuration: any;
  totalFaqPairs: number;
  pendingQuestions: number;
  pendingAnswers: number;
  completedBatches: number;
  recentBatches: any[];
  performanceStats: any;
  accountCompletion: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!user || authError) {
          router.push('/login');
          return;
        }

        // Load all dashboard data
        const [
          invoiceResult,
          endUserResult,
          organisationResult,
          brandsResult,
          personasResult,
          productsResult,
          configurationResult,
          faqPairsResult,
          pendingQuestionsResult,
          pendingAnswersResult,
          recentBatchesResult,
          performanceResult
        ] = await Promise.all([
          // Get latest invoice
          supabase
            .from('invoices')
            .select('*')
            .eq('auth_user_id', user.id)
            .order('inserted_at', { ascending: false })
            .limit(1),
          
          // Get end user profile
          supabase
            .from('end_users')
            .select('*')
            .eq('auth_user_id', user.id)
            .maybeSingle(),
          
          // Get organisation
          supabase
            .from('client_organisation')
            .select('*')
            .eq('auth_user_id', user.id)
            .maybeSingle(),
          
          // Get brands
          supabase
            .from('client_brands')
            .select('*')
            .eq('auth_user_id', user.id),
          
          // Get personas
          supabase
            .from('client_product_persona')
            .select('*')
            .eq('auth_user_id', user.id),
          
          // Get products
          supabase
            .from('client_products')
            .select('*')
            .eq('auth_user_id', user.id),
          
          // Get AI configuration
          supabase
            .from('client_configuration')
            .select('*')
            .eq('auth_user_id', user.id)
            .maybeSingle(),
          
          // Get total FAQ pairs produced
          supabase
            .from('batch_faq_pairs')
            .select('faq_count_in_batch')
            .eq('auth_user_id', user.id),
          
          // Get pending questions
          supabase
            .from('review_questions')
            .select('id')
            .eq('auth_user_id', user.id)
            .eq('question_status', 'questions_generated'),
          
          // Get pending answers
          supabase
            .from('review_questions')
            .select('id')
            .eq('auth_user_id', user.id)
            .eq('answer_status', 'completed')
            .not('ai_response_answers', 'is', null),
          
          // Get recent batches
          supabase
            .from('batch_faq_pairs')
            .select('*')
            .eq('auth_user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5),
          
          // Get performance stats
          supabase
            .from('faq_performance_logs')
            .select('*')
            .eq('auth_user_id', user.id)
            .eq('test_schedule', 'monthly')
            .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
        ]);

        const invoice = invoiceResult.data?.[0];
        const endUser = endUserResult.data;
        const organisation = organisationResult.data;
        const brands = brandsResult.data || [];
        const personas = personasResult.data || [];
        const products = productsResult.data || [];
        const configuration = configurationResult.data;
        const totalFaqPairs = faqPairsResult.data?.reduce((sum, batch) => sum + batch.faq_count_in_batch, 0) || 0;
        const pendingQuestions = pendingQuestionsResult.data?.length || 0;
        const pendingAnswers = pendingAnswersResult.data?.length || 0;
        const completedBatches = faqPairsResult.data?.length || 0;
        const recentBatches = recentBatchesResult.data || [];
        const performanceStats = performanceResult.data || [];

        // Calculate account completion percentage (6 steps)
        let completionSteps = 0;
        let totalSteps = 6;
        
        if (endUser) completionSteps++;
        if (organisation) completionSteps++;
        if (brands.length > 0) completionSteps++;
        if (personas.length > 0) completionSteps++;
        if (products.length > 0) completionSteps++;
        if (configuration) completionSteps++;
        
        const accountCompletion = Math.round((completionSteps / totalSteps) * 100);

        setData({
          user,
          invoice,
          endUser,
          organisation,
          brands,
          personas,
          products,
          configuration,
          totalFaqPairs,
          pendingQuestions,
          pendingAnswers,
          completedBatches,
          recentBatches,
          performanceStats,
          accountCompletion
        });

      } catch (error) {
        console.error('Error loading dashboard:', error);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [router]);

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
            <h2 className="text-xl font-semibold text-red-400 mb-2">Dashboard Error</h2>
            <p className="text-gray-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-gray-300 mb-2">No Data Available</h2>
            <p className="text-gray-400">Please complete your onboarding to see your dashboard.</p>
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
          <h1 className="text-4xl font-bold text-white mb-2">Welcome back!</h1>
          <p className="text-gray-400">Here&apos;s what&apos;s happening with your BrandAION account</p>
        </div>

        {/* Account Completion */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Account Setup</h2>
              <span className="text-2xl font-bold text-green-400">{data.accountCompletion}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${data.accountCompletion}%` }}
              ></div>
            </div>
            <p className="text-gray-300 text-sm mt-2">
              {data.accountCompletion === 100 ? 'Account fully configured!' : 'Complete your setup to unlock full features'}
            </p>
          </div>
        </div>

        {/* Setup Guidance - Show if account is not complete */}
        {data.accountCompletion < 100 && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 border border-amber-500/30 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Complete Your Setup</h2>
              <div className="space-y-3">
                {!data.endUser && (
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className="text-gray-300">Create Profile</span>
                    </div>
                    <button
                      onClick={() => router.push('/end_user_form')}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Complete
                    </button>
                  </div>
                )}
                
                {!data.organisation && (
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <span className="text-gray-300">Create Organisation</span>
                    </div>
                    <button
                      onClick={() => router.push('/organisation_form')}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Complete
                    </button>
                  </div>
                )}
                
                {data.brands.length === 0 && (
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                      <span className="text-gray-300">Create Brands</span>
                    </div>
                    <button
                      onClick={() => router.push('/client_brands_form')}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Complete
                    </button>
                  </div>
                )}
                
                {data.personas.length === 0 && (
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <span className="text-gray-300">Create Persona</span>
                    </div>
                    <button
                      onClick={() => router.push('/client_product_persona_form')}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Complete
                    </button>
                  </div>
                )}
                
                {data.products.length === 0 && (
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <span className="text-gray-300">Create Products</span>
                    </div>
                    <button
                      onClick={() => router.push('/client_products')}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Complete
                    </button>
                  </div>
                )}
                
                {!data.configuration && (
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <span className="text-gray-300">Configure AI</span>
                    </div>
                    <button
                      onClick={() => router.push('/client_configuration_form')}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Complete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total FAQ Pairs */}
          <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total FAQ Pairs</p>
                <p className="text-3xl font-bold text-white">{data.totalFaqPairs}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Pending Questions */}
          <div className="bg-gradient-to-br from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Pending Questions</p>
                <p className="text-3xl font-bold text-white">{data.pendingQuestions}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Pending Answers */}
          <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Pending Answers</p>
                <p className="text-3xl font-bold text-white">{data.pendingAnswers}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Completed Batches */}
          <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Completed Batches</p>
                <p className="text-3xl font-bold text-white">{data.completedBatches}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Package Details */}
        {data.invoice && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-gray-600/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Your Package</h2>
                <button
                  onClick={() => router.push('/packages')}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                >
                  Change Package →
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-gray-400 text-sm">Package Tier</p>
                  <p className="text-lg font-semibold text-white">{data.invoice.package_tier}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">FAQ Pairs per Month</p>
                  <p className="text-lg font-semibold text-white">{data.invoice.faq_pairs_pm}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Monthly Cost</p>
                  <p className="text-lg font-semibold text-white">${(data.invoice.amount_cents / 100).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Batches & Monitoring Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Recent Batches */}
          <div className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-gray-600/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Recent Batches</h2>
              <button
                onClick={() => router.push('/faq-batches')}
                className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
              >
                View All →
              </button>
            </div>
            {data.recentBatches.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-400">No batches yet</p>
                <button
                  onClick={() => router.push('/schedule')}
                  className="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm transition-colors"
                >
                  Generate First Batch
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {data.recentBatches.map((batch) => (
                  <div key={batch.id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                    <div>
                      <p className="text-white font-medium">{batch.product || 'Unknown Product'}</p>
                      <p className="text-gray-400 text-sm">{batch.faq_count_in_batch} FAQ pairs</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-300 text-sm">{new Date(batch.created_at).toLocaleDateString()}</p>
                      <span className="inline-block bg-green-600 text-white px-2 py-1 rounded text-xs">
                        ✓ Completed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Performance Monitoring */}
          <div className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-gray-600/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Performance Monitoring</h2>
              <button
                onClick={() => router.push('/monthly-report')}
                className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
              >
                View Report →
              </button>
            </div>
            {data.performanceStats.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-gray-400">No performance data yet</p>
                <button
                  onClick={() => router.push('/faq-performance')}
                  className="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm transition-colors"
                >
                  Set Up Monitoring
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-gray-800/30 rounded-lg">
                    <p className="text-2xl font-bold text-white">{data.performanceStats.length}</p>
                    <p className="text-gray-400 text-sm">Tests This Month</p>
                  </div>
                  <div className="text-center p-3 bg-gray-800/30 rounded-lg">
                    <p className="text-2xl font-bold text-white">
                      {Math.round(data.performanceStats.reduce((sum: number, test: any) => {
                        const scores = [test.openai_accuracy_score, test.gemini_accuracy_score, test.perplexity_accuracy_score, test.claude_accuracy_score].filter(Boolean);
                        return sum + (scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0);
                      }, 0) / data.performanceStats.length)}%
                    </p>
                    <p className="text-gray-400 text-sm">Avg Accuracy</p>
                  </div>
                </div>
                <div className="text-center p-3 bg-gray-800/30 rounded-lg">
                  <p className="text-lg font-semibold text-white">Latest Test Results</p>
                  <p className="text-gray-400 text-sm mt-1">
                    {data.performanceStats[0]?.tested_llms?.join(', ') || 'No providers tested'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.pendingQuestions > 0 && (
              <button
                onClick={() => router.push('/review-questions')}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                Review Questions ({data.pendingQuestions})
              </button>
            )}
            
            {data.pendingAnswers > 0 && (
              <button
                onClick={() => router.push('/review-answers')}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                Review Answers ({data.pendingAnswers})
              </button>
            )}
            
            <button
              onClick={() => router.push('/faq-batches')}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              View FAQ Batches
            </button>
            
            <button
              onClick={() => router.push('/faq-pairs')}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              View FAQ Pairs
            </button>
            
            <button
              onClick={() => router.push('/faq-performance')}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              Test FAQ Performance
            </button>
            
            <button
              onClick={() => router.push('/schedule')}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              View Schedule
            </button>
          </div>
        </div>

        {/* Account Management */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Account Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={() => router.push('/end_user_form')}
              className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/50 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
            >
              Update Profile
            </button>
            
            <button
              onClick={() => router.push('/organisation_form')}
              className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/50 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
            >
              Organisation Settings
            </button>
            
            <button
              onClick={() => router.push('/client_brands_form')}
              className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/50 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
            >
              Manage Brands
            </button>
            
            <button
              onClick={() => router.push('/client_products')}
              className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/50 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
            >
              Manage Products
            </button>
            
            <button
              onClick={() => router.push('/client_product_persona_form')}
              className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/50 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
            >
              Create Persona
            </button>
            
            <button
              onClick={() => router.push('/client_configuration_form')}
              className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/50 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
            >
              AI Configuration
            </button>
            
            <button
              onClick={() => router.push('/invoice_confirmation')}
              className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/50 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
            >
              Billing & Invoices
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 