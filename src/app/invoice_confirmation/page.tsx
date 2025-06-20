'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function InvoiceConfirmationContent() {
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
        .order('inserted_at', { ascending: false })
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

    console.log('Creating schedule for invoice:', invoice);

    try {
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const response = await fetch('https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/invoices-to-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          invoice_id: invoice.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Schedule creation failed:', errorData);
        throw new Error(errorData.error || 'Failed to create schedule');
      }

      const data = await response.json();
      console.log('Schedule created successfully:', data);
      setMessage('✅ Schedule created successfully!');
    } catch (error) {
      console.error('Error creating schedule:', error);
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
              <p>Amount Paid: ${(invoice.amount_cents / 100).toFixed(2)}</p>
              <p>Date: {new Date(invoice.inserted_at).toLocaleDateString()}</p>
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
          
          {message.includes('✅') && (
            <div className="mt-4">
              <button
                onClick={() => router.push('/schedule')}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition"
              >
                View Your Schedule
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface Invoice {
  id: string;
  user_email: string;
  auth_user_id: string;
  amount_cents: number;
  stripe_payment_id: string;
  billing_period_start: string;
  billing_period_end: string;
  paid_at: string;
  status: string;
  package_tier: string;
  faq_pairs_pm: number;
  faq_per_batch: number;
  inserted_at: string;
  sent_to_schedule: boolean;
}

export default function InvoiceConfirmation() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md mx-auto">
        <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
          <p className="text-gray-400">Please wait while we load your invoice details...</p>
        </div>
      </div>
    }>
      <InvoiceConfirmationContent />
    </Suspense>
  );
} 