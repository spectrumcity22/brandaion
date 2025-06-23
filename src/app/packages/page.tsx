'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Package {
  tier: string;
  faq_pairs_pm: number;
  faq_per_batch: number;
  batches_required: number;
  price_per_faq: number;
  package_cost: number;
  cogs_per_faq: number;
  cogs_total: number;
  profit: number;
  profit_margin: string;
  positioning: string;
  sales_message: string;
  amount_cents: number;
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .order('package_cost', { ascending: true });

      if (error) throw error;
      setPackages(data || []);
    } catch (error) {
      console.error('Error fetching packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPackageColor = (tier: string) => {
    switch (tier) {
      case 'Enterprise':
        return 'from-purple-600 via-purple-700 to-purple-800';
      case 'Pro':
        return 'from-blue-600 via-blue-700 to-blue-800';
      case 'Growth':
        return 'from-emerald-600 via-emerald-700 to-emerald-800';
      case 'Startup':
        return 'from-orange-500 via-orange-600 to-orange-700';
      default:
        return 'from-gray-600 via-gray-700 to-gray-800';
    }
  };

  const getPackageIcon = (tier: string) => {
    switch (tier) {
      case 'Enterprise':
        return '🚀';
      case 'Pro':
        return '⚡';
      case 'Growth':
        return '📈';
      case 'Startup':
        return '💡';
      default:
        return '📦';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading packages...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Choose Your <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Growth Path</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-12">
              Scale your brand&apos;s AI visibility with our comprehensive FAQ generation packages. 
              From startup to enterprise, we have the perfect solution for your needs.
            </p>
          </div>
        </div>
      </div>

      {/* Packages Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {packages.map((pkg, index) => (
            <div
              key={pkg.tier}
              className={`relative group cursor-pointer transform transition-all duration-300 hover:scale-105 ${
                selectedPackage === pkg.tier ? 'ring-4 ring-blue-400' : ''
              }`}
              onClick={() => setSelectedPackage(pkg.tier)}
            >
              {/* Background Gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${getPackageColor(pkg.tier)} rounded-3xl opacity-90`}></div>
              
              {/* Content */}
              <div className="relative bg-gray-900/80 backdrop-blur-sm rounded-3xl p-8 h-full border border-gray-700/50 hover:border-gray-500/50 transition-all duration-300">
                {/* Package Icon */}
                <div className="text-4xl mb-4">{getPackageIcon(pkg.tier)}</div>
                
                {/* Package Name */}
                <h3 className="text-2xl font-bold text-white mb-2">{pkg.tier}</h3>
                
                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">${pkg.package_cost}</span>
                  <span className="text-gray-400 ml-2">/month</span>
                </div>

                {/* Key Metrics */}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">FAQ Pairs/Month:</span>
                    <span className="text-white font-semibold">{pkg.faq_pairs_pm}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Per Batch:</span>
                    <span className="text-white font-semibold">{pkg.faq_per_batch}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Batches:</span>
                    <span className="text-white font-semibold">{pkg.batches_required}</span>
                  </div>
                </div>

                {/* Positioning */}
                <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                  {pkg.positioning}
                </p>

                {/* Sales Message */}
                <div className="bg-white/10 rounded-xl p-4 mb-6">
                  <p className="text-white font-medium text-sm">
                    {pkg.sales_message}
                  </p>
                </div>

                {/* CTA Button */}
                <Link
                  href={pkg.tier === 'Startup' ? 'https://buy.stripe.com/test_3cI8wR0Kk2oW18K9N65J602' : '/select_package'}
                  className="block w-full bg-white text-gray-900 font-bold py-3 px-6 rounded-xl text-center hover:bg-gray-100 transition-colors duration-200 transform hover:scale-105"
                >
                  Get Started
                </Link>

                {/* Popular Badge for Pro */}
                {pkg.tier === 'Pro' && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
                      Most Popular
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Detailed Comparison
          </h2>
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-gray-700/50">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-800/50">
                    <th className="px-6 py-4 text-left text-white font-semibold">Feature</th>
                    {packages.map(pkg => (
                      <th key={pkg.tier} className="px-6 py-4 text-center text-white font-semibold">
                        {pkg.tier}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  <tr>
                    <td className="px-6 py-4 text-gray-300">Monthly FAQ Pairs</td>
                    {packages.map(pkg => (
                      <td key={pkg.tier} className="px-6 py-4 text-center text-white font-semibold">
                        {pkg.faq_pairs_pm}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-300">FAQ per Batch</td>
                    {packages.map(pkg => (
                      <td key={pkg.tier} className="px-6 py-4 text-center text-white">
                        {pkg.faq_per_batch}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-300">Batches Required</td>
                    {packages.map(pkg => (
                      <td key={pkg.tier} className="px-6 py-4 text-center text-white">
                        {pkg.batches_required}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-300">Price per FAQ</td>
                    {packages.map(pkg => (
                      <td key={pkg.tier} className="px-6 py-4 text-center text-white">
                        ${pkg.price_per_faq}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-300">Monthly Cost</td>
                    {packages.map(pkg => (
                      <td key={pkg.tier} className="px-6 py-4 text-center text-white font-bold">
                        ${pkg.package_cost}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl p-8 border border-gray-700/50">
            <h3 className="text-2xl font-bold text-white mb-4">
              Ready to Transform Your Brand&apos;s AI Presence?
            </h3>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Join hundreds of brands already leveraging our AI-powered FAQ generation to dominate their categories and drive organic growth.
            </p>
            <Link
              href="/select_package"
              className="inline-block bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold py-4 px-8 rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-200 transform hover:scale-105"
            >
              Start Your Journey Today
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 