'use client';

export default function SelectPackage() {
  const handleSelect = () => {
    // Replace this with your live or test Stripe Checkout URL
    window.location.href = 'https://buy.stripe.com/test_3cI8wR0Kk2oW18K9N65J602';
  };

  return (
    <div className="bg-black text-white min-h-screen flex items-center justify-center pt-24">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center space-y-6 w-full max-w-md">
        <h1 className="text-2xl font-bold">Select a Package</h1>
        <p className="text-gray-400 text-sm">
          Unlock full features with our Test Package. Secure Stripe checkout will open in a new tab.
        </p>
        <button
          onClick={handleSelect}
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-black font-bold rounded-lg transition"
        >
          Subscribe Now
        </button>
      </div>
    </div>
  );
}
