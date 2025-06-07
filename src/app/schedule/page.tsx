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
  batch_1_date: string;
  batch_2_date: string;
  batch_3_date: string;
  batch_4_date: string;
  faq_pairs_pm: number;
  faq_per_batch: number;
}

export default function Schedule() {
  const router = useRouter();
  const [schedule, setSchedule] = useState<Schedule[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    </div>
  );
} 