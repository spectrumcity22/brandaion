'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function OnboardingRouter() {
  const router = useRouter();
  const [message, setMessage] = useState('Checking your account status...');

  useEffect(() => {
    (async () => {
      // Check authentication
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!user || error) {
        setMessage('Not logged in. Redirecting to login...');
        setTimeout(() => router.push('/login'), 1000);
        return;
      }

      // Check end user profile
      const { data: endUser } = await supabase
        .from('end_users')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (!endUser) {
        setMessage('Profile incomplete. Redirecting to profile form...');
        setTimeout(() => router.push('/end_user_form'), 1000);
        return;
      }

      // Check organization details
      const { data: org } = await supabase
        .from('client_organisation')
        .select('id, is_active')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (!org || !org.is_active) {
        setMessage('Organization details needed. Redirecting to organization form...');
        setTimeout(() => router.push('/organisation_form'), 1000);
        return;
      }

      // Check for active package/invoice
      const { data: invoice } = await supabase
        .from('invoices')
        .select('id, package_status')
        .eq('auth_user_id', user.id)
        .eq('package_status', 'active')
        .maybeSingle();

      // If no invoice exists or it's not reviewed, go to package selection
      if (!invoice) {
        setMessage('Package selection needed. Redirecting to package selection...');
        setTimeout(() => router.push('/select_package'), 1000);
        return;
      }

      // Check if schedule has been created
      const { data: schedule } = await supabase
        .from('schedules')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (!schedule) {
        // If no schedule exists, go to invoice confirmation first
        // The webhook will create the schedule after invoice confirmation
        setMessage('Invoice review needed. Redirecting to invoice confirmation...');
        setTimeout(() => router.push('/invoice_confirmation'), 1000);
        return;
      }

      // If everything is complete, go to schedule
      setMessage('All set! Redirecting to your schedule...');
      setTimeout(() => router.push('/schedule'), 1000);
    })();
  }, [router]);

  return (
    <div className="w-full max-w-md mx-auto pt-24">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center">
        <h1 className="text-xl font-bold mb-4">Welcome to BrandAION</h1>
        <div className="text-sm text-gray-400">{message}</div>
      </div>
    </div>
  );
} 