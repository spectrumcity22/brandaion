'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EndUserForm() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        setSessionUser(user);
      }
    })();
  }, [router]);

  const handleSubmit = async () => {
    if (!firstName || !lastName) {
      setMessage('Please fill in all fields.');
      return;
    }

    if (!sessionUser) {
      setMessage('User not authenticated.');
      return;
    }

    setIsSubmitting(true);
    setMessage('Submitting...');
    const auth_user_id = sessionUser.id;

    try {
      const { data: existingUser } = await supabase
        .from('end_users')
        .select('id')
        .eq('auth_user_id', auth_user_id)
        .maybeSingle();

      if (!existingUser) {
        const { error: insertError } = await supabase.from('end_users').insert({
          auth_user_id,
          email: sessionUser.email || '',
          first_name: firstName,
          last_name: lastName,
          status: 'active',
        });
        if (insertError) throw insertError;
      } else {
        const { error: updateError } = await supabase
          .from('end_users')
          .update({
            email: sessionUser.email || '',
            first_name: firstName,
            last_name: lastName,
            status: 'active',
          })
          .eq('auth_user_id', auth_user_id);
        if (updateError) throw updateError;
      }

      setMessage('✅ Profile saved!');
      
      // Auto-redirect to organisation form after 2 seconds
      setTimeout(() => {
        router.push('/organisation_form');
      }, 2000);
    } catch (err: any) {
      setMessage(`❌ Error: ${err?.message || 'Unexpected failure'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="glass-card p-8 text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full premium-gradient flex items-center justify-center text-2xl glow-animation">
            👤
          </div>
          <h1 className="text-3xl font-bold mb-2 shimmer-text">Complete Your BrandAION Profile</h1>
          <p className="text-gray-400">Set up your account to get started with AI-powered FAQ generation</p>
        </div>

        <div className="glass-card p-8">
          {sessionUser && (
            <div className="mb-6 p-4 glass-card text-center">
              <div className="text-2xl mb-2">✅</div>
              <h2 className="text-lg font-semibold mb-1">Logged in as</h2>
              <p className="text-brand font-medium">{sessionUser.email}</p>
            </div>
          )}

          {message && (
            <div className={`mb-6 p-4 rounded-lg text-center ${
              message.includes('❌') 
                ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                : 'bg-green-500/10 text-green-400 border border-green-500/20'
            }`}>
              {message}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                👤 First Name
              </label>
              <input
                type="text"
                placeholder="Enter your first name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="glass-input w-full p-4"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                👤 Last Name
              </label>
              <input
                type="text"
                placeholder="Enter your last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="glass-input w-full p-4"
                required
              />
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`premium-button flex-1 ${isSubmitting ? 'premium-loading' : ''}`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
                  Submitting...
                </div>
              ) : (
                '✨ Complete Profile'
              )}
            </button>
            
            <button
              onClick={() => router.push('/dashboard')}
              className="glass-input p-4 hover:bg-white/10 transition-colors"
            >
              🏠 Back to Dashboard
            </button>
          </div>
        </div>

        {/* Success Action */}
        {message.includes('✅') && (
          <div className="glass-card p-8 mt-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center text-2xl">
              🎉
            </div>
            <h2 className="text-xl font-semibold mb-4">Profile Created Successfully!</h2>
            <p className="text-gray-400 mb-6">Now let&apos;s set up your organisation details</p>
            <button
              onClick={() => router.push('/organisation_form')}
              className="premium-button"
            >
              🏢 Continue to Organisation Form
            </button>
          </div>
        )}

        {/* Help Section */}
        <div className="glass-card p-8 mt-8">
          <h2 className="text-2xl font-bold mb-6">💡 Getting Started</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-3">👤</div>
              <h3 className="font-semibold mb-2">Complete Profile</h3>
              <p className="text-gray-400 text-sm">Fill in your personal and organisation details</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">🏢</div>
              <h3 className="font-semibold mb-2">Organisation Setup</h3>
              <p className="text-gray-400 text-sm">Configure your organisation details and industry</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">🚀</div>
              <h3 className="font-semibold mb-2">Start Generating</h3>
              <p className="text-gray-400 text-sm">Begin creating AI-powered FAQ content</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}