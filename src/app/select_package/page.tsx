'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SelectPackage() {
  const router = useRouter();
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Check if we're returning from Stripe
    const params = new URLSearchParams(window.location.search);
    if (params.get('success')) {
      // Redirect to invoice confirmation after successful payment
      router.push('/invoice_confirmation');
    }
  }, [router]);

  const handleSelect = () => {
    setMessage('Redirecting to secure payment...');
    // Replace this with your live or test Stripe Checkout URL
    window.location.href = 'https://buy.stripe.com/test_3cI8wR0Kk2oW18K9N65J602';
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center space-y-6">
        <h1 className="text-2xl font-bold">Select a Package</h1>
        <p className="text-gray-400 text-sm">
          Unlock full features with our Test Package. Secure Stripe checkout will open in a new tab.
        </p>
        <button
          onClick={handleSelect}
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-black font-bold rounded-lg transition"
        >
          Subscribe Now
        </button>
        {message && <div className="text-sm text-green-400">{message}</div>}
      </div>
    </div>
  );
} 