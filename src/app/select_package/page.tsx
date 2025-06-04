'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'stripe-buy-button': {
        'buy-button-id': string;
        'publishable-key': string;
      } & React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

export default function SelectPackage() {
  const buttonContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Clean up any existing Stripe scripts to avoid duplicates
    const existingScript = document.querySelector('script[src*="buy-button.js"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Create and append the Stripe Buy Button element
    if (buttonContainerRef.current) {
      const button = document.createElement('stripe-buy-button');
      button.setAttribute('buy-button-id', 'buy_btn_1RPJ8sRvWgSPtSJgqGbSlxOO');
      button.setAttribute('publishable-key', 'pk_test_51RNpiKRvWgSPtSJgvn68JgXu9yFj5D7NGdU1qhFOq3l4BG2cL9vdLXlejbUIk6G4CYfP6wYkL5486mU8fs5v4kmp00pdB58vXl');
      buttonContainerRef.current.innerHTML = '';
      buttonContainerRef.current.appendChild(button);
    }
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">Select Your Package</h1>
        <p className="text-gray-400">Choose the perfect plan for your needs</p>
      </div>

      <Script 
        src="https://js.stripe.com/v3/buy-button.js"
        strategy="afterInteractive"
      />

      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg">
        <div className="flex justify-center">
          <div ref={buttonContainerRef} />
        </div>

        <div className="mt-8 text-center text-sm text-gray-400">
          <p>After purchase, you&apos;ll be redirected to set up your schedule.</p>
          <p>Need help? Contact our support team.</p>
        </div>
      </div>
    </div>
  );
} 