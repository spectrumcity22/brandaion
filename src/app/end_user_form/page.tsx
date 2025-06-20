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
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        setSessionUser(user);
        setEmail(user.email || '');
      }
    })();
  }, [router]);

  const handleSubmit = async () => {
    if (!firstName || !lastName || !orgName) {
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
          org_name: orgName,
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
            org_name: orgName,
            status: 'active',
          })
          .eq('auth_user_id', auth_user_id);
        if (updateError) throw updateError;
      }

      const { data: existingOrg } = await supabase
        .from('client_organisation')
        .select('id')
        .eq('auth_user_id', auth_user_id)
        .maybeSingle();

      if (!existingOrg) {
        const { data: orgData, error: orgError } = await supabase
          .from('client_organisation')
          .insert([{ organisation_name: orgName, auth_user_id }])
          .select()
          .single();

        if (orgError || !orgData?.id) throw orgError;
        localStorage.setItem('organisation_id', orgData.id);
      }

      setMessage('✅ Profile and organisation saved!');
    } catch (err: any) {
      setMessage(`❌ Error: ${err?.message || 'Unexpected failure'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center">
        <h2 className="text-xl font-bold mb-4">Complete Your BrandAION Profile</h2>

        {email && (
          <div className="text-green-400 text-sm mb-4">
            Logged in as: {email}
          </div>
        )}

        <input
          type="text"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="w-full p-3 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white"
        />
        <input
          type="text"
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="w-full p-3 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white"
        />
        <input
          type="text"
          placeholder="Organisation Name"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          className="w-full p-3 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white"
        />

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`w-full py-3 font-bold rounded-lg transition ${
            isSubmitting
              ? 'bg-gray-600 text-white cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-black'
          }`}
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>

        <div className="text-sm mt-4 text-center text-red-400">{message}</div>
        
        {message.includes('✅') && (
          <div className="mt-4">
            <button
              onClick={() => router.push('/organisation_form')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Continue to Organization Form
            </button>
          </div>
        )}
      </div>
    </div>
  );
}