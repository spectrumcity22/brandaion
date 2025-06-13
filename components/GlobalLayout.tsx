'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function GlobalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session?.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setLoggedIn(!!session?.user);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen font-sans bg-white text-black">
      <nav className="fixed top-0 left-0 w-full bg-black text-white flex items-center justify-between px-6 py-4 shadow-md z-50">
        <div className="text-xl font-bold">BrandAION</div>
        <div className="flex space-x-6 text-sm font-medium">
          {!loggedIn ? (
            <>
              <Link href="/signup" className="hover:text-green-400">Sign Up</Link>
              <Link href="/login" className="hover:text-green-400">Login</Link>
            </>
          ) : (
            <>
              <Link href="/dashboard" className="hover:text-green-400">Dashboard</Link>
              <Link href="/end_user_form" className="hover:text-green-400">End User Form</Link>
              <Link href="/organisation_form" className="hover:text-green-400">Client Organisation</Link>
              <Link href="/invoice_confirmation" className="hover:text-green-400">Invoice</Link>
              <button onClick={handleLogout} className="hover:text-red-400">Log Out</button>
            </>
          )}
        </div>
      </nav>
      <main className="pt-24 px-4">{children}</main>
    </div>
  );
}
