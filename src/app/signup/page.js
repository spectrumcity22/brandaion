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

    // Check if email is already registered
    if (data?.user?.identities?.length === 0) {
      setMessage('⚠️ This email is already registered. Please check your email for the verification link or try logging in.');
      return;
    }

    // Create end_user record immediately
    const auth_user_id = data.user.id;
    const { error: insertError } = await supabase.from('end_users').insert([
      { email, auth_user_id },
    ]);

    if (insertError) {
      console.error('Insert error:', insertError);
      setMessage('⚠️ Account created but profile setup failed. Please contact support.');
      return;
    }

    setMessage('🔑 Success! Please check your email to verify your account before logging in. The verification link will expire in 24 hours.');

    // Clear the form
    setEmail('');
    setPassword('');
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
    
