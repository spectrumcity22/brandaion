'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  org_name?: string;
}

export default function EndUserForm() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [existingProfile, setExistingProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setSessionUser(user);

      // Check if profile already exists
      const { data: profile } = await supabase
        .from('end_users')
        .select('id, first_name, last_name, email, org_name')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (profile) {
        setExistingProfile(profile);
        setFirstName(profile.first_name);
        setLastName(profile.last_name);
      }
      setIsLoading(false);
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
      setExistingProfile({
        id: existingUser?.id || 'new',
        first_name: firstName,
        last_name: lastName,
        email: sessionUser.email || '',
        org_name: existingProfile?.org_name
      });
      setIsEditing(false);
      
      // Remove auto-redirect - let user stay on the page
    } catch (err: any) {
      setMessage(`❌ Error: ${err?.message || 'Unexpected failure'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="glass-card p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show existing profile with edit button
  if (existingProfile && !isEditing) {
    return (
      <div className="min-h-screen p-4 lg:p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="glass-card p-8 text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full premium-gradient flex items-center justify-center text-2xl glow-animation">
              👤
            </div>
            <h1 className="text-3xl font-bold mb-2 shimmer-text">Your Profile</h1>
            <p className="text-gray-400">Your profile is already set up</p>
          </div>

          <div className="glass-card p-8">
            <div className="mb-6 p-4 glass-card text-center">
              <div className="text-2xl mb-2">✅</div>
              <h2 className="text-lg font-semibold mb-1">Logged in as</h2>
              <p className="text-brand font-medium">{sessionUser?.email}</p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center p-4 bg-gray-800/30 rounded-lg">
                <div>
                  <p className="text-gray-400 text-sm">First Name</p>
                  <p className="text-white font-medium">{existingProfile.first_name}</p>
                </div>
                <div className="text-green-400">✓</div>
              </div>

              <div className="flex justify-between items-center p-4 bg-gray-800/30 rounded-lg">
                <div>
                  <p className="text-gray-400 text-sm">Last Name</p>
                  <p className="text-white font-medium">{existingProfile.last_name}</p>
                </div>
                <div className="text-green-400">✓</div>
              </div>

              {existingProfile.org_name && (
                <div className="flex justify-between items-center p-4 bg-gray-800/30 rounded-lg">
                  <div>
                    <p className="text-gray-400 text-sm">Organisation</p>
                    <p className="text-white font-medium">{existingProfile.org_name}</p>
                  </div>
                  <div className="text-green-400">✓</div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setIsEditing(true)}
                className="premium-button flex-1"
              >
                ✏️ Edit Profile
              </button>
              
              <button
                onClick={() => router.push('/dashboard')}
                className="glass-input p-4 hover:bg-white/10 transition-colors"
              >
                🏠 Back to Dashboard
              </button>
              
              <button
                onClick={() => router.push('/organisation_form')}
                className="glass-input p-4 hover:bg-white/10 transition-colors"
              >
                🏢 Organisation
              </button>
            </div>

            {!existingProfile.org_name && (
              <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
                <p className="text-blue-400 mb-3">Next step: Set up your organisation</p>
                <button
                  onClick={() => router.push('/organisation_form')}
                  className="premium-button"
                >
                  🏢 Continue to Organisation Setup
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show edit form or new profile form
  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="glass-card p-8 text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full premium-gradient flex items-center justify-center text-2xl glow-animation">
            👤
          </div>
          <h1 className="text-3xl font-bold mb-2 shimmer-text">
            {existingProfile ? 'Edit Your Profile' : 'Complete Your BrandAION Profile'}
          </h1>
          <p className="text-gray-400">
            {existingProfile ? 'Update your profile information' : 'Set up your account to get started with AI-powered FAQ generation'}
          </p>
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
                existingProfile ? '✨ Update Profile' : '✨ Save Profile'
              )}
            </button>
            
            {existingProfile && (
              <button
                onClick={() => setIsEditing(false)}
                className="glass-input p-4 hover:bg-white/10 transition-colors"
              >
                ❌ Cancel
              </button>
            )}
            
            <button
              onClick={() => router.push('/dashboard')}
              className="glass-input p-4 hover:bg-white/10 transition-colors"
            >
              🏠 Back to Dashboard
            </button>
            
            <button
              onClick={() => router.push('/organisation_form')}
              className="glass-input p-4 hover:bg-white/10 transition-colors"
            >
              🏢 Organisation
            </button>
          </div>
        </div>

        {/* Success Action */}
        {message.includes('✅') && !existingProfile?.org_name && (
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