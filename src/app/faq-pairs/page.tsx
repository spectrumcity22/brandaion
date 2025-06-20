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

export default function FAQPairsPage() {
  const router = useRouter();
  const [faqPairs, setFaqPairs] = useState<FAQPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
            batch_id,
            created_at,
            question_status,
            answer_status,
            organisation_jsonld_object
          `)
          .eq('auth_user_id', user.id)
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
            batch_id: pair.batch_id,
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

  const filteredPairs = faqPairs.filter(pair => {
    const matchesSearch = pair.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pair.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pair.organisation_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'completed' && pair.answer_status === 'completed') ||
                         (statusFilter === 'pending' && pair.answer_status !== 'completed') ||
                         (statusFilter === 'approved' && pair.question_status === 'approved');

    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string, type: 'question' | 'answer') => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-semibold";
    
    if (type === 'question') {
      switch (status) {
        case 'approved':
          return <span className={`${baseClasses} bg-green-500/20 text-green-400 border border-green-500/30`}>Approved</span>;
        case 'pending':
          return <span className={`${baseClasses} bg-yellow-500/20 text-yellow-400 border border-yellow-500/30`}>Pending</span>;
        default:
          return <span className={`${baseClasses} bg-gray-500/20 text-gray-400 border border-gray-500/30`}>{status}</span>;
      }
    } else {
      switch (status) {
        case 'completed':
          return <span className={`${baseClasses} bg-blue-500/20 text-blue-400 border border-blue-500/30`}>Completed</span>;
        default:
          return <span className={`${baseClasses} bg-orange-500/20 text-orange-400 border border-orange-500/30`}>Pending</span>;
      }
    }
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
            <h2 className="text-xl font-semibold text-red-400 mb-2">Error Loading FAQ Pairs</h2>
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
          <h1 className="text-4xl font-bold text-white mb-2">FAQ Pairs</h1>
          <p className="text-gray-400">Your complete collection of generated FAQ pairs</p>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Completed</p>
                <p className="text-3xl font-bold text-white">{stats.completed}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Pending</p>
                <p className="text-3xl font-bold text-white">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Approved</p>
                <p className="text-3xl font-bold text-white">{stats.approved}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-gray-600/50 rounded-xl p-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-300 mb-2">Search FAQ Pairs</label>
                <input
                  type="text"
                  placeholder="Search questions, answers, or organization..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:border-green-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Status Filter */}
              <div className="md:w-48">
                <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white focus:border-green-500 focus:outline-none transition-colors"
                >
                  <option value="all">All FAQ Pairs</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Pairs List */}
        <div className="space-y-6">
          {filteredPairs.length === 0 ? (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-gray-600/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-300 mb-2">No FAQ Pairs Found</h3>
              <p className="text-gray-400">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filters' 
                  : 'Start generating FAQ pairs to see them here'}
              </p>
            </div>
          ) : (
            filteredPairs.map((pair) => (
              <div key={pair.id} className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-gray-600/50 rounded-xl p-6 hover:border-gray-500/50 transition-all duration-200">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Question Section */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-white">Question</h3>
                      {getStatusBadge(pair.question_status, 'question')}
                    </div>
                    <p className="text-gray-300 leading-relaxed">{pair.question}</p>
                  </div>

                  {/* Answer Section */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-white">Answer</h3>
                      {getStatusBadge(pair.answer_status, 'answer')}
                    </div>
                    <p className="text-gray-300 leading-relaxed">{pair.answer}</p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="mt-6 pt-4 border-t border-gray-600/30">
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>{pair.organisation_name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                      </svg>
                      <span>{pair.industry}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{formatDate(pair.created_at)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span>Batch: {pair.batch_id}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Results Count */}
        {filteredPairs.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-gray-400">
              Showing {filteredPairs.length} of {faqPairs.length} FAQ pairs
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 