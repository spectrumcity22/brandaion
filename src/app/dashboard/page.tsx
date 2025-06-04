'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    router.push('/onboarding_router');
  }, [router]);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-lg text-center">
        <h1 className="text-2xl font-bold mb-4">Redirecting...</h1>
        <p className="text-gray-400">Taking you to your dashboard...</p>
      </div>
    </div>
  );
} 