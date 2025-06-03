'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function OnboardingRouter() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!user || error) {
        router.push('/login');
        return;
      }

      const { data: endUser } = await supabase
        .from('end_users')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (!endUser) {
        router.push('/end_user_form');
        return;
      }

      const { data: org } = await supabase
        .from('client_organisation')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (!org) {
        router.push('/organisation_form');
        return;
      }

      const { data: invoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('auth_user_id', user.id)
        .eq('package_status', 'active')
        .maybeSingle();

      if (!invoice) {
        router.push('/select_package');
        return;
      }

      router.push('/schedule');
    })();
  }, [router]);

  return (
    <div className="p-8 text-white bg-black min-h-screen">
      <h1 className="text-xl font-bold">Loading your account...</h1>
    </div>
  );
}
