'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EndUserForm() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        setSessionUser(user);
        setEmail(user.email);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    setMessage('Submitting...');
    const auth_user_id = sessionUser.id;

    const { data: existingUser } = await supabase
      .from('end_users')
      .select('id')
      .eq('auth_user_id', auth_user_id)
      .maybeSingle();

    if (!existingUser) {
      const { error: insertError } = await supabase.from('end_users').insert({
        auth_user_id,
        first_name: firstName,
        last_name: lastName,
        org_name: orgName,
        status: 'active',
      });
      if (insertError) {
        setMessage(`Failed to create profile: ${insertError.message}`);
        return;
      }
    } else {
      const { error: updateError } = await supabase
        .from('end_users')
        .update({
          first_name: firstName,
          last_name: lastName,
          org_name: orgName,
          status: 'active',
        })
        .eq('auth_user_id', auth_user_id);
      if (updateError) {
        setMessage(`Failed to update profile: ${updateError.message}`);
        return;
      }
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

      if (orgError || !orgData?.id) {
        setMessage(`Failed to create organisation: ${orgError?.message}`);
        return;
      }

      localStorage.setItem('organisation_id', orgData.id);
    }

    setMessage('✅ Profile and organisation saved!');
    setTimeout(() => router.push('/organisation_form'), 1000);
  };

  return (
    <div className="bg-black text-white pt-24 flex flex-col items-center min-h-screen">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg w-full max-w-md text-center">
        <h2 className="text-xl font-bold mb-4">Complete Your BrandAION Profile</h2>
        <div className="text-green-400 text-sm mb-4">{email && `Logged in as: ${email}`}</div>
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
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-black font-bold rounded-lg transition"
        >
          Submit
        </button>
        <div className="text-sm mt-4 text-center text-red-400">{message}</div>
      </div>
    </div>
  );
}
