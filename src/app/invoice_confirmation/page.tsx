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

  const getPackageIcon = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'premium': return '👑';
      case 'pro': return '💎';
      case 'starter': return '⭐';
      default: return '📦';
    }
  };

  const getPackageGradient = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'premium': return 'gold-gradient';
      case 'pro': return 'premium-gradient';
      case 'starter': return 'bronze-gradient';
      default: return 'premium-gradient';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center float-animation">
          <div className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold shimmer-text">Processing Payment</h2>
          <p className="text-gray-400 mt-2">Please wait while we confirm your transaction...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center text-3xl">
            ❌
          </div>
          <h1 className="text-2xl font-bold mb-4">No Invoice Found</h1>
          <p className="text-gray-400 mb-6">{message}</p>
          <button
            onClick={() => router.push('/select_package')}
            className="premium-button w-full"
          >
            🛒 Select a Package
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Success Header */}
        <div className="glass-card p-8 text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center text-4xl glow-animation">
            ✅
          </div>
          <h1 className="text-3xl font-bold mb-2 shimmer-text">Payment Confirmed!</h1>
          <p className="text-gray-400">Your subscription is now active and ready to use</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Payment Details */}
          <div className="glass-card p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              💳 Payment Details
            </h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 glass-card">
                <span className="text-gray-400">Package:</span>
                <span className="font-semibold">{invoice.package_tier}</span>
              </div>
              
              <div className="flex justify-between items-center p-4 glass-card">
                <span className="text-gray-400">Amount Paid:</span>
                <span className="font-bold text-2xl text-brand">
                  ${(invoice.amount_cents / 100).toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-4 glass-card">
                <span className="text-gray-400">Date:</span>
                <span>{new Date(invoice.inserted_at).toLocaleDateString()}</span>
              </div>
              
              <div className="flex justify-between items-center p-4 glass-card">
                <span className="text-gray-400">Status:</span>
                <span className="text-green-400 font-semibold">✅ Paid</span>
              </div>
            </div>
          </div>

          {/* Package Details */}
          <div className="glass-card p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              {getPackageIcon(invoice.package_tier)} Package Details
            </h2>
            
            <div className={`p-6 rounded-2xl ${getPackageGradient(invoice.package_tier)} mb-6 text-center`}>
              <h3 className="text-xl font-bold mb-2">{invoice.package_tier} Package</h3>
              <p className="text-sm opacity-80">Premium FAQ Generation Service</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="glass-card p-4 text-center">
                <div className="text-3xl font-bold text-brand mb-1">{invoice.faq_pairs_pm}</div>
                <div className="text-sm text-gray-400">FAQ Pairs per Month</div>
              </div>
              <div className="glass-card p-4 text-center">
                <div className="text-3xl font-bold text-brand mb-1">{invoice.faq_per_batch}</div>
                <div className="text-sm text-gray-400">FAQ Pairs per Batch</div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-2 glass-card">
                <span className="text-gray-400">Billing Period:</span>
                <span>{new Date(invoice.billing_period_start).toLocaleDateString()} - {new Date(invoice.billing_period_end).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Section */}
        <div className="glass-card p-8 mt-8">
          {message && (
            <div className={`mb-6 p-4 rounded-lg text-center ${
              message.includes('❌') 
                ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                : 'bg-green-500/10 text-green-400 border border-green-500/20'
            }`}>
              {message}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleCreateSchedule}
              disabled={creatingSchedule}
              className={`premium-button flex-1 ${creatingSchedule ? 'premium-loading' : ''}`}
            >
              {creatingSchedule ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
                  Creating Schedule...
                </div>
              ) : (
                '🚀 Create Your Schedule'
              )}
            </button>
            
            {message.includes('✅') && (
              <button
                onClick={() => router.push('/schedule')}
                className="glass-input p-4 hover:bg-white/10 transition-colors"
              >
                📅 View Your Schedule
              </button>
            )}
          </div>
        </div>

        {/* Next Steps */}
        <div className="glass-card p-8 mt-8">
          <h2 className="text-2xl font-bold mb-6">🎯 What's Next?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-3">📅</div>
              <h3 className="font-semibold mb-2">Create Schedule</h3>
              <p className="text-gray-400 text-sm">Set up your FAQ generation schedule</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">⚙️</div>
              <h3 className="font-semibold mb-2">Configure Settings</h3>
              <p className="text-gray-400 text-sm">Customize your FAQ preferences</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="font-semibold mb-2">Monitor Performance</h3>
              <p className="text-gray-400 text-sm">Track your FAQ performance metrics</p>
            </div>
          </div>
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
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
          <p className="text-gray-400">Please wait while we load your invoice details...</p>
        </div>
      </div>
    }>
      <InvoiceConfirmationContent />
    </Suspense>
  );
} 