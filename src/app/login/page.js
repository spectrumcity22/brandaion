'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [welcome, setWelcome] = useState('');

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    if (params.get('type') === 'signup') {
      setWelcome('✅ Email verified. Welcome back! Please log in.');
    }
  }, []);

  const handleLogin = async () => {
    setMessage('Logging in...');
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
    } else {
      router.push('/onboarding_router'); // Redirect to onboarding logic
    }
  };

  return (
    <div className="pt-24 flex flex-col items-center min-h-screen bg-black text-white">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold text-center mb-4">Login to BrandAION</h2>
        {welcome && <div className="text-green-400 text-center mb-4 text-sm">{welcome}</div>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white"
        />
        <button
          onClick={handleLogin}
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-black font-bold rounded-lg transition"
        >
          Log In
        </button>
        <div className="text-sm text-red-400 mt-4 text-center">{message}</div>
      </div>
    </div>
  );
}
