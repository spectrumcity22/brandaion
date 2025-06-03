'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function InvoicePage() {
  const router = useRouter();
  const [debug, setDebug] = useState('');
  const [invoice, setInvoice] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (!user || error) {
        setDebug('❌ Not logged in. Redirecting to login...');
        setTimeout(() => router.push('/login'), 1500);
        return;
      }

      setDebug(`✅ Logged in as ${user.email}`);

      const { data: invoices, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .eq('auth_user_id', user.id)
        .order('inserted_at', { ascending: false })
        .limit(1);

      if (fetchError || !invoices?.[0]) {
        setDebug('⚠️ No invoice found for this user.');
        return;
      }

      setInvoice(invoices[0]);
    })();
  }, []);

  return (
    <div className="bg-black text-white pt-24 flex flex-col items-center min-h-screen">
      <div className="text-sm text-red-400 mb-4">{debug}</div>

      {invoice && (
        <div className="bg-gray-900 p-8 rounded-2xl shadow-lg w-full max-w-md">
          <h1 className="text-xl font-bold text-center mb-6">Your Latest Invoice</h1>
          <div className="text-sm text-gray-300 space-y-2 text-left">
            <p><strong>Plan:</strong> {invoice.package_tier || 'N/A'}</p>
            <p><strong>FAQ pairs/month:</strong> {invoice.faq_pairs_pm || 'N/A'}</p>
            <p><strong>FAQ pairs/batch:</strong> {invoice.faq_per_batch || 'N/A'}</p>
            <p><strong>Batch Dates:</strong></p>
            <ul className="list-disc ml-6">
              <li>{invoice.batch_1_date || '—'}</li>
              <li>{invoice.batch_2_date || '—'}</li>
              <li>{invoice.batch_3_date || '—'}</li>
              <li>{invoice.batch_4_date || '—'}</li>
            </ul>
            {invoice.hosted_invoice_url && (
              <a
                href={invoice.hosted_invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 underline block mt-2"
              >
                View Hosted Invoice
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
