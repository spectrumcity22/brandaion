'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PaymentSuccess() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const steps = [
    { message: "Thank you. The payment was received from Stripe.", icon: "✅" },
    { message: "Processing Invoice...", icon: "🔄" },
    { message: "Matching user to payment...", icon: "🔄" },
    { message: "Completed!", icon: "🎉" }
  ];

  useEffect(() => {
    processPayment();
  }, []);

  const processPayment = async () => {
    try {
      // Step 1: Payment received (already done)
      setCurrentStep(0);
      await delay(2000);

      // Step 2: Process webhooks
      setCurrentStep(1);
      const webhookResult = await fetch('/api/process-stripe-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!webhookResult.ok) {
        throw new Error('Failed to process webhook');
      }
      
      await delay(2000);

      // Step 3: Match user (poll for auth_user_id)
      setCurrentStep(2);
      await pollForUserMatch();
      await delay(2000);

      // Step 4: Completed
      setCurrentStep(3);
      setIsProcessing(false);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsProcessing(false);
    }
  };

  const pollForUserMatch = async () => {
    // Poll for invoice with auth_user_id set
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .not('auth_user_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (invoices && invoices.length > 0) {
        return invoices[0];
      }

      await delay(1000);
      attempts++;
    }

    throw new Error('User matching timeout');
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleScheduleClick = async () => {
    try {
      const response = await fetch('https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/invoices-to-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        // Redirect to dashboard or schedule page
        window.location.href = '/dashboard';
      } else {
        alert('Failed to process schedule. Please try again.');
      }
    } catch (err) {
      alert('Error processing schedule. Please try again.');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Processing Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => window.location.href = '/packages'}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Return to Packages
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center">
          {isProcessing ? (
            <>
              <div className="text-6xl mb-6 animate-pulse">
                {steps[currentStep].icon}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {steps[currentStep].message}
              </h2>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                ></div>
              </div>
            </>
          ) : (
            <>
              <div className="text-6xl mb-6">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Payment Complete!
              </h2>
              <p className="text-gray-600 mb-6">
                Your subscription has been activated successfully.
              </p>
              <button 
                onClick={handleScheduleClick}
                className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors"
              >
                Review Your Schedule
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 