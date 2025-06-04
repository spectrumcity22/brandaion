'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserSchedule = async () => {
      try {
        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!user || authError) {
          router.push('/login');
          return;
        }

        // Check if user has any schedules
        const { data: schedules, error: scheduleError } = await supabase
          .from('schedules')
          .select('id')
          .eq('auth_user_id', user.id)
          .limit(1);

        if (scheduleError) {
          console.error('Error checking schedule:', scheduleError);
          router.push('/onboarding_router');
          return;
        }

        // If user has a schedule, go to schedule page, otherwise go to onboarding
        if (schedules && schedules.length > 0) {
          router.push('/schedule');
        } else {
          router.push('/onboarding_router');
        }
      } catch (error) {
        console.error('Error in dashboard:', error);
        router.push('/onboarding_router');
      } finally {
        setLoading(false);
      }
    };

    checkUserSchedule();
  }, [router]);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center">
        <h1 className="text-2xl font-bold mb-4">Checking your account...</h1>
        <p className="text-gray-400">We&apos;re getting things ready for you...</p>
      </div>
    </div>
  );
} 