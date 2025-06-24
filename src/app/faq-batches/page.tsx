'use client';

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface FAQBatch {
  id: string;
  unique_batch_id: string;
  batch_date: string;
  organisation: string;
  product_name: string;
  faq_pairs_object: any;
  batch_status: string;
  created_at: string;
  updated_at: string;
}

export default function FAQBatches() {
  const [batches, setBatches] = useState<FAQBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Get user on component load
    (async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setError('Authentication required');
        setLoading(false);
        return;
      }
      setUser(user);
      fetchBatches(user.id);
    })();
  }, []);

  const fetchBatches = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('batch_faq_pairs')
        .select('*')
        .eq('auth_user_id', userId)
        .order('batch_date', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      setBatches(data || []);
    } catch (error) {
      console.error('Fetch error:', error);
      setError('Failed to load FAQ batches');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Group batches by date
  const groupedBatches = batches.reduce((groups: Record<string, FAQBatch[]>, batch) => {
    const date = batch.batch_date.split('T')[0]; // Get just the date part
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(batch);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-200"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto mt-8">
        <div className="bg-red-900 text-red-200 p-4 rounded">{error}</div>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="max-w-4xl mx-auto mt-8">
        <h1 className="text-3xl font-bold mb-6 text-foreground">FAQ Batches</h1>
        <div className="text-center text-lg text-foreground">No FAQ batches found</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">FAQ Batches</h1>
      
      {Object.entries(groupedBatches)
        .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
        .map(([date, dateBatches]) => (
          <div key={date} className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground border-b border-gray-700 pb-2">
              {formatDate(date)}
            </h2>
            
            <div className="space-y-4">
              {dateBatches.map((batch) => (
                <div key={batch.id} className="bg-gray-800 p-6 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">
                        {batch.product_name} - {batch.faq_pairs_object?.brand || 'N/A'}
                      </h3>
                      <p className="text-gray-300 text-sm">
                        <span className="font-medium">Organisation:</span> {batch.organisation}
                      </p>
                      <p className="text-gray-300 text-sm">
                        <span className="font-medium">Audience:</span> {batch.faq_pairs_object?.audience || 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-gray-300 text-sm">
                        <span className="font-medium">Batch ID:</span> {batch.unique_batch_id}
                      </p>
                      <p className="text-gray-300 text-sm">
                        <span className="font-medium">Cluster:</span> {batch.faq_pairs_object?.batchNo || 'N/A'}
                      </p>
                      <p className="text-gray-300 text-sm">
                        <span className="font-medium">FAQ Count:</span> {batch.faq_pairs_object?.faqCountInBatch || 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-gray-300 text-sm">
                        <span className="font-medium">Created:</span> {formatTime(batch.created_at)}
                      </p>
                      <p className="text-gray-300 text-sm">
                        <span className="font-medium">Updated:</span> {formatTime(batch.updated_at)}
                      </p>
                      <div className="mt-2">
                        <span className={`inline-block px-2 py-1 rounded text-xs ${
                          batch.batch_status === 'batch_published' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-yellow-600 text-white'
                        }`}>
                          {batch.batch_status === 'batch_published' ? '✓ Published' : '○ Generated'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {batch.faq_pairs_object && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <details className="text-sm">
                        <summary className="cursor-pointer text-blue-400 hover:text-blue-300">
                          View FAQ Pairs Details
                        </summary>
                        <div className="mt-2 p-3 bg-gray-900 rounded text-xs overflow-auto max-h-60">
                          <pre className="text-gray-300">
                            {JSON.stringify(batch.faq_pairs_object, null, 2)}
                          </pre>
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
} 