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

  useEffect(() => {
    (async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!user || authError) {
        router.push('/login');
        return;
      }

      // Get the end_user_id for this user
      const { data: endUser, error: endUserError } = await supabase
        .from('end_users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (endUserError || !endUser) {
        setError('No end user found for this account.');
        setLoading(false);
        return;
      }

      // Fetch all schedule rows for this end user, ordered by batch_date
      const { data, error: scheduleError } = await supabase
        .from('schedule')
        .select('*')
        .eq('auth_user_id', endUser.id)
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
          product_name: s.organisation, // or s.product_name if available
          id: s.unique_batch_cluster, // or another unique id
          market: s.organisation, // or s.market if available
          description: '', // fill as needed
          keywords: '', // fill as needed
          url: '', // fill as needed
          brand_name: s.organisation,
          category: '', // fill as needed
          organisation: s.organisation,
          schema_json: {}, // fill as needed
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        setProductMessage('❌ Failed to create product: ' + errorData.error);
      } else {
        setProductMessage('✅ Product created successfully!');
        setTimeout(() => router.push('/client_products'), 1200);
      }
    } catch (err: any) {
      setProductMessage('❌ Error: ' + err.message);
    } finally {
      setCreatingProduct(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4">Loading Schedule...</h1>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!schedule || schedule.length === 0) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4">No Schedule Found</h1>
          <p className="text-gray-400">Please complete the onboarding process first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center">
        <h1 className="text-2xl font-bold mb-6">Your FAQ Schedule</h1>
        
        <div className="space-y-6">
          <div className="text-left">
            <h2 className="text-lg font-semibold mb-2">FAQ Details</h2>
            <p className="text-gray-400">Pairs per month: {schedule[0].total_faq_pairs}</p>
            <p className="text-gray-400">Pairs per batch: {schedule[0].batch_faq_pairs}</p>
          </div>

          <div className="text-left">
            <h2 className="text-lg font-semibold mb-2">Batch Dates</h2>
            <div className="space-y-2">
              {schedule.slice(0, 4).map((s, idx) => (
                <p className="text-gray-400" key={s.id}>
                  Batch {idx + 1}: {formatDate(s.batch_date)}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
      {Array.isArray(schedule) && schedule.length > 0 && (
        <div className="mt-6 text-center">
          <button
            onClick={handleCreateProduct}
            disabled={creatingProduct}
            className={`px-6 py-2 rounded-lg font-bold transition ${creatingProduct ? 'bg-gray-600 text-white cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
          >
            {creatingProduct ? 'Creating Product...' : 'Create Product'}
          </button>
          {productMessage && <div className="mt-2 text-sm">{productMessage}</div>}
        </div>
      )}
    </div>
  );
} 