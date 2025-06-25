'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Schedule {
  id: string;
  auth_user_id: string;
  organisation_id: string;
  unique_batch_cluster: string;
  unique_batch_id: string;
  batch_date: string;
  batch_faq_pairs: number;
  total_faq_pairs: number;
  sent_for_processing: boolean;
  inserted_at: string;
  organisation: string;
  user_email: string;
}

export default function Schedule() {
  const router = useRouter();
  const [schedule, setSchedule] = useState<Schedule[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [productMessage, setProductMessage] = useState('');
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [productExists, setProductExists] = useState(false);
  const [productCheckComplete, setProductCheckComplete] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!user || authError) {
        router.push('/login');
        return;
      }

      // Fetch all schedule rows for this user, ordered by batch_date
      const { data, error: scheduleError } = await supabase
        .from('schedule')
        .select('*')
        .eq('auth_user_id', user.id)
        .order('batch_date', { ascending: true });

      if (scheduleError) {
        setError('Failed to load schedule. Please try again later.');
      } else if (data && data.length > 0) {
        setSchedule(data); // set as an array
      } else {
        setSchedule([]);
      }
      setLoading(false);
    })();
  }, [router]);

  // Check if product exists and handle auto-creation
  useEffect(() => {
    if (!schedule || schedule.length === 0 || loading) return;

    const checkAndCreateProduct = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const userId = session.user.id;
        
        // Get the user's organisation_id
        const { data: org, error: orgError } = await supabase
          .from('client_organisation')
          .select('id')
          .eq('auth_user_id', userId)
          .single();

        if (orgError || !org) return;

        // Check if product already exists for this organization
        const { data: existingProduct, error: productError } = await supabase
          .from('products')
          .select('id')
          .eq('organisation_id', org.id)
          .single();

        if (productError && productError.code !== 'PGRST116') {
          // PGRST116 is "not found" error, which is expected if no product exists
          console.error('Error checking product:', productError);
          return;
        }

        if (existingProduct) {
          // Product exists, show success state immediately
          setProductExists(true);
          setProductMessage('✅ Product already exists!');
        } else {
          // Product doesn't exist, auto-create after 2 seconds
          setProductMessage('⏳ Auto-creating product in 2 seconds...');
          
          setTimeout(async () => {
            await handleCreateProduct();
          }, 2000);
        }
      } catch (err) {
        console.error('Error in checkAndCreateProduct:', err);
      } finally {
        setProductCheckComplete(true);
      }
    };

    checkAndCreateProduct();
  }, [schedule, loading]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleCreateProduct = async () => {
    if (!schedule || schedule.length === 0) return;
    setCreatingProduct(true);
    setProductMessage('Creating product...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session found');
      const userId = session.user.id;
      // Fetch the user's organisation_id using the session user id
      const { data: org, error: orgError } = await supabase
        .from('client_organisation')
        .select('id')
        .eq('auth_user_id', userId)
        .single();
      if (orgError || !org) throw new Error('No organisation found for this user');
      // Use the first schedule as the product source
      const s = schedule[0];
      const response = await fetch('https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/products-upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          organisation_id: org.id,
          product_name: s.organisation, // Use organization name as product name
          description: '', // fill as needed
          keywords: '', // fill as needed
          url: '', // fill as needed
          category: '', // fill as needed
          organisation: s.organisation,
          schema_json: {}, // fill as needed
          auth_user_id: userId,
          user_email: s.user_email
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        setProductMessage('❌ Failed to create product: ' + errorData.error);
      } else {
        setProductExists(true);
        setProductMessage('✅ Product created successfully!');
      }
    } catch (err: any) {
      setProductMessage('❌ Error: ' + err.message);
    } finally {
      setCreatingProduct(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center float-animation">
          <div className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold shimmer-text">Loading Your Schedule</h2>
          <p className="text-gray-400 mt-2">Preparing your FAQ generation timeline...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center text-3xl">
            ❌
          </div>
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-red-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="premium-button"
          >
            🏠 Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!schedule || schedule.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-yellow-500/20 flex items-center justify-center text-3xl">
            📅
          </div>
          <h1 className="text-2xl font-bold mb-4">No Schedule Found</h1>
          <p className="text-gray-400 mb-6">Please complete the onboarding process first.</p>
          <button
            onClick={() => router.push('/end_user_form')}
            className="premium-button"
          >
            🚀 Start Onboarding
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="glass-card p-8 text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full premium-gradient flex items-center justify-center text-2xl glow-animation">
            📅
          </div>
          <h1 className="text-3xl font-bold mb-2 shimmer-text">Your FAQ Schedule</h1>
          <p className="text-gray-400">Your automated FAQ generation timeline</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* FAQ Details */}
          <div className="glass-card p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              📊 FAQ Details
            </h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 glass-card">
                <span className="text-gray-400">Pairs per Month:</span>
                <span className="font-bold text-2xl text-brand">{schedule[0].total_faq_pairs}</span>
              </div>
              
              <div className="flex justify-between items-center p-4 glass-card">
                <span className="text-gray-400">Pairs per Batch:</span>
                <span className="font-bold text-2xl text-brand">{schedule[0].batch_faq_pairs}</span>
              </div>
              
              <div className="flex justify-between items-center p-4 glass-card">
                <span className="text-gray-400">Total Batches:</span>
                <span className="font-semibold">{schedule.length}</span>
              </div>
            </div>
          </div>

          {/* Batch Dates */}
          <div className="glass-card p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              📅 Batch Schedule
            </h2>
            
            <div className="space-y-3">
              {schedule.slice(0, 6).map((s, idx) => (
                <div key={s.id} className="flex justify-between items-center p-3 glass-card">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-sm font-bold mr-3">
                      {idx + 1}
                    </div>
                    <span className="font-medium">Batch {idx + 1}</span>
                  </div>
                  <span className="text-gray-400">{formatDate(s.batch_date)}</span>
                </div>
              ))}
              
              {schedule.length > 6 && (
                <div className="text-center text-gray-400 text-sm mt-4">
                  +{schedule.length - 6} more batches
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Product Creation */}
        {Array.isArray(schedule) && schedule.length > 0 && (
          <div className="glass-card p-8 mt-8">
            <h2 className="text-2xl font-bold mb-6">🚀 Quick Actions</h2>
            
            {productMessage && (
              <div className={`mb-6 p-4 rounded-lg text-center ${
                productMessage.includes('❌') 
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                  : productMessage.includes('⏳')
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'bg-green-500/10 text-green-400 border border-green-500/20'
              }`}>
                {productMessage}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              {!productExists && (
                <button
                  onClick={handleCreateProduct}
                  disabled={creatingProduct}
                  className={`premium-button flex-1 ${creatingProduct ? 'premium-loading' : ''}`}
                >
                  {creatingProduct ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
                      Creating Product...
                    </div>
                  ) : (
                    '📦 Create Product'
                  )}
                </button>
              )}
              
              <button
                onClick={() => router.push('/dashboard')}
                className="glass-input p-4 hover:bg-white/10 transition-colors"
              >
                🏠 Back to Dashboard
              </button>
            </div>
            
            {productExists && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => router.push('/client_product_persona_form')}
                  className="premium-button"
                >
                  🎭 Create Product Persona
                </button>
              </div>
            )}
          </div>
        )}

        {/* Help Section */}
        <div className="glass-card p-8 mt-8">
          <h2 className="text-2xl font-bold mb-6">💡 Schedule Information</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-3">📅</div>
              <h3 className="font-semibold mb-2">Automated Generation</h3>
              <p className="text-gray-400 text-sm">FAQs will be generated automatically on schedule</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="font-semibold mb-2">Batch Processing</h3>
              <p className="text-gray-400 text-sm">Content is created in manageable batches</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">🚀</div>
              <h3 className="font-semibold mb-2">Ready to Use</h3>
              <p className="text-gray-400 text-sm">Your schedule is active and ready for production</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 