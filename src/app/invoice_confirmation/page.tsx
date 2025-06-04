'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Invoice {
  id: string;
  package_tier: string;
  package_status: string;
  amount_paid: number;
  faq_pairs_pm: number;
  faq_per_batch: number;
  stripe_session_id?: string;
  created_at: string;
}

export default function InvoiceConfirmation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [creatingSchedule, setCreatingSchedule] = useState(false);

  useEffect(() => {
    const loadInvoice = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!user || authError) {
        router.push('/login');
        return;
      }

      // Get the latest invoice for the user
      const { data: invoices, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .eq('auth_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError || !invoices?.[0]) {
        setMessage('No invoice found. Please complete the payment process.');
        setLoading(false);
        return;
      }

      setInvoice(invoices[0]);
      setLoading(false);
    };

    loadInvoice();
  }, [router]);

  const handleCreateSchedule = async () => {
    if (!invoice || creatingSchedule) return;

    setCreatingSchedule(true);
    setMessage('Creating your schedule...');

    try {
      const response = await fetch('https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/create_schedule_batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoice_id: invoice.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create schedule');
      }

      const data = await response.json();
      setMessage('✅ Schedule created successfully!');
      setTimeout(() => router.push('/schedule'), 1500);
    } catch (error) {
      setMessage('❌ Failed to create schedule. Please try again.');
      setCreatingSchedule(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4">Loading Invoice...</h1>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4">No Invoice Found</h1>
          <p className="text-gray-400 mb-4">{message}</p>
          <button
            onClick={() => router.push('/select_package')}
            className="w-full py-3 bg-green-500 hover:bg-green-600 text-black font-bold rounded-lg transition"
          >
            Select a Package
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center">
        <h1 className="text-2xl font-bold mb-6">Payment Confirmed</h1>
        
        <div className="space-y-6">
          <div className="text-left">
            <h2 className="text-lg font-semibold mb-2">Payment Details</h2>
            <div className="space-y-2 text-gray-400">
              <p>Package: {invoice.package_tier}</p>
              <p>Amount Paid: ${(invoice.amount_paid / 100).toFixed(2)}</p>
              <p>Date: {new Date(invoice.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="text-left">
            <h2 className="text-lg font-semibold mb-2">Package Details</h2>
            <div className="space-y-2 text-gray-400">
              <p>FAQ Pairs per Month: {invoice.faq_pairs_pm}</p>
              <p>FAQ Pairs per Batch: {invoice.faq_per_batch}</p>
            </div>
          </div>

          {message && (
            <div className={`text-sm ${message.includes('❌') ? 'text-red-400' : 'text-green-400'}`}>
              {message}
            </div>
          )}

          <button
            onClick={handleCreateSchedule}
            disabled={creatingSchedule}
            className={`w-full py-3 font-bold rounded-lg transition ${
              creatingSchedule
                ? 'bg-gray-600 text-white cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-black'
            }`}
          >
            {creatingSchedule ? 'Creating Schedule...' : 'Create Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
} 