'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSignup = async () => {
    setMessage('Signing up...');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const auth_user_id = data?.user?.id;
    if (!auth_user_id) {
      setMessage('Signup succeeded but user ID was not returned.');
      return;
    }

    const insertRes = await supabase.from('end_users').insert([
      { email, auth_user_id },
    ]);

    if (insertRes.error) {
      console.error('Insert error:', insertRes.error);
      setMessage(
        'Signup succeeded, but failed to create profile: ' +
          insertRes.error.message
      );
    } else {
      setMessage('✅ Signup successful! Check your email for confirmation.');
    }
  };

  return (
    <div className="pt-24 flex flex-col items-center min-h-screen bg-black text-white">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold text-center mb-6">
          Create Your BrandAION Account
        </h2>
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
          onClick={handleSignup}
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-black font-bold rounded-lg transition"
        >
          Sign Up
        </button>
        <div className="text-sm text-red-400 mt-4 text-center">{message}</div>
      </div>
    </div>
  );
}
