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
  schedule: any;
  totalFaqPairs: number;
  pendingQuestions: number;
  pendingAnswers: number;
  completedBatches: number;
  accountCompletion: number;
  profileComplete: boolean;
  organisationConfigured: boolean;
  brands: any[];
  personas: any[];
  products: any[];
  aiConfig: any;
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

        // Check if user has completed onboarding
        const { data: endUser } = await supabase
          .from('end_users')
          .select('id, first_name, last_name, org_name')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        // Load all dashboard data (don't redirect if missing)
        const [
          invoiceResult,
          scheduleResult,
          faqPairsResult,
          pendingQuestionsResult,
          pendingAnswersResult
        ] = await Promise.all([
          // Get latest invoice
          supabase
            .from('invoices')
            .select('*')
            .eq('auth_user_id', user.id)
            .order('inserted_at', { ascending: false })
            .limit(1),
          
          // Get schedule
          supabase
            .from('schedule')
            .select('*')
            .eq('auth_user_id', user.id)
            .order('inserted_at', { ascending: false })
            .limit(1),
          
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
            .not('ai_response_answers', 'is', null)
        ]);

        const invoice = invoiceResult.data?.[0];
        const schedule = scheduleResult.data?.[0];
        const totalFaqPairs = faqPairsResult.data?.reduce((sum, batch) => sum + batch.faq_count_in_batch, 0) || 0;
        const pendingQuestions = pendingQuestionsResult.data?.length || 0;
        const pendingAnswers = pendingAnswersResult.data?.length || 0;
        const completedBatches = faqPairsResult.data?.length || 0;

        // Calculate account completion percentage - updated logic
        let completionSteps = 0;
        let totalSteps = 6; // Updated to 6 steps
        
        // Check if profile is complete (has first_name, last_name, org_name)
        const profileComplete = endUser && endUser.first_name && endUser.last_name && endUser.org_name;
        if (profileComplete) completionSteps++;
        
        // Check if organisation is configured
        const { data: organisation } = await supabase
          .from('client_organisation')
          .select('id, organisation_url, industry, headquarters')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        const organisationConfigured = organisation && organisation.organisation_url && organisation.industry && organisation.headquarters;
        if (organisationConfigured) completionSteps++;
        
        // Check if brands exist
        const { data: brands } = await supabase
          .from('brands')
          .select('id')
          .eq('auth_user_id', user.id);
        if (brands && brands.length > 0) completionSteps++;
        
        // Check if persona exists
        const { data: personas } = await supabase
          .from('client_product_persona')
          .select('id')
          .eq('auth_user_id', user.id);
        if (personas && personas.length > 0) completionSteps++;
        
        // Check if products exist
        const { data: products } = await supabase
          .from('products')
          .select('id')
          .eq('auth_user_id', user.id);
        if (products && products.length > 0) completionSteps++;
        
        // Check if AI is configured
        const { data: aiConfig } = await supabase
          .from('client_configuration')
          .select('id')
          .eq('auth_user_id', user.id);
        if (aiConfig) completionSteps++;
        
        const accountCompletion = Math.round((completionSteps / totalSteps) * 100);

        setData({
          user,
          invoice,
          schedule,
          totalFaqPairs,
          pendingQuestions,
          pendingAnswers,
          completedBatches,
          accountCompletion,
          profileComplete,
          organisationConfigured,
          brands: brands || [],
          personas: personas || [],
          products: products || [],
          aiConfig
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
                {/* Setup Profile */}
                <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      data.profileComplete 
                        ? 'bg-green-500/20' 
                        : 'bg-red-500/20'
                    }`}>
                      {data.profileComplete ? (
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-gray-300">Setup Profile</span>
                  </div>
                  {data.profileComplete ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-green-400 text-sm">Completed</span>
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <button
                      onClick={() => router.push('/end_user_form')}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Go
                    </button>
                  )}
                </div>

                {/* Setup Organisation */}
                <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      data.organisationConfigured 
                        ? 'bg-green-500/20' 
                        : 'bg-yellow-500/20'
                    }`}>
                      {data.organisationConfigured ? (
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      )}
                    </div>
                    <span className="text-gray-300">Setup Organisation</span>
                  </div>
                  {data.organisationConfigured ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-green-400 text-sm">Completed</span>
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <button
                      onClick={() => router.push('/organisation_form')}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Go
                    </button>
                  )}
                </div>

                {/* Create a Brand */}
                <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      data.brands.length > 0 
                        ? 'bg-green-500/20' 
                        : 'bg-blue-500/20'
                    }`}>
                      {data.brands.length > 0 ? (
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-gray-300">Create a Brand</span>
                  </div>
                  {data.brands.length > 0 ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-green-400 text-sm">Completed</span>
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <button
                      onClick={() => router.push('/client_brands_form')}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Go
                    </button>
                  )}
                </div>

                {/* Create a Product */}
                <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      data.products.length > 0 
                        ? 'bg-green-500/20' 
                        : 'bg-purple-500/20'
                    }`}>
                      {data.products.length > 0 ? (
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      )}
                    </div>
                    <span className="text-gray-300">Create a Product</span>
                  </div>
                  {data.products.length > 0 ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-green-400 text-sm">Completed</span>
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <button
                      onClick={() => router.push('/client_products')}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Go
                    </button>
                  )}
                </div>

                {/* Create a Persona */}
                <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      data.personas.length > 0 
                        ? 'bg-green-500/20' 
                        : 'bg-indigo-500/20'
                    }`}>
                      {data.personas.length > 0 ? (
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-gray-300">Create a Persona</span>
                  </div>
                  {data.personas.length > 0 ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-green-400 text-sm">Completed</span>
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <button
                      onClick={() => router.push('/client_product_persona_form')}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Go
                    </button>
                  )}
                </div>

                {/* Configure AI */}
                <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      data.aiConfig 
                        ? 'bg-green-500/20' 
                        : 'bg-pink-500/20'
                    }`}>
                      {data.aiConfig ? (
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-gray-300">Configure AI</span>
                  </div>
                  {data.aiConfig ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-green-400 text-sm">Completed</span>
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <button
                      onClick={() => router.push('/client_configuration_form')}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Go
                    </button>
                  )}
                </div>
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
              <h2 className="text-xl font-semibold text-white mb-4">Your Package</h2>
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

        {/* Available Packages */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Available Packages</h2>
            <button
              onClick={() => router.push('/packages')}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
            >
              View All Packages →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { tier: 'Startup', price: 99, faq_pairs: 20, color: 'from-orange-500/20 to-orange-600/20', border: 'border-orange-500/30' },
              { tier: 'Growth', price: 199, faq_pairs: 40, color: 'from-emerald-500/20 to-emerald-600/20', border: 'border-emerald-500/30' },
              { tier: 'Pro', price: 299, faq_pairs: 60, color: 'from-blue-500/20 to-blue-600/20', border: 'border-blue-500/30' },
              { tier: 'Enterprise', price: 399, faq_pairs: 80, color: 'from-purple-500/20 to-purple-600/20', border: 'border-purple-500/30' }
            ].map((pkg) => (
              <div key={pkg.tier} className={`bg-gradient-to-br ${pkg.color} border ${pkg.border} rounded-xl p-4 relative group hover:scale-105 transition-all duration-200`}>
                {pkg.tier === 'Pro' && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 px-2 py-1 rounded-full text-xs font-bold">
                      Popular
                    </span>
                  </div>
                )}
                <div className="text-center">
                  <h3 className="text-lg font-bold text-white mb-2">{pkg.tier}</h3>
                  <div className="mb-3">
                    <span className="text-2xl font-bold text-white">${pkg.price}</span>
                    <span className="text-gray-300 text-sm ml-1">/month</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-4">{pkg.faq_pairs} FAQ pairs/month</p>
                  <button
                    onClick={() => router.push('/select_package')}
                    className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
                  >
                    {data.invoice?.package_tier === pkg.tier ? 'Current Plan' : 'Upgrade'}
                  </button>
                </div>
              </div>
            ))}
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
              Organization Settings
            </button>
            
            <button
              onClick={() => router.push('/client_brands_form')}
              className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/50 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
            >
              Brand Management
            </button>
            
            <button
              onClick={() => router.push('/client_products')}
              className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/50 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
            >
              Manage Products
            </button>
            
            <button
              onClick={() => router.push('/client_product_persona_form')}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              Manage Personas
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