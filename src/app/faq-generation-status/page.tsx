'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface FAQPair {
  id: string;
  ai_request_for_questions: string;
  ai_response_questions: string | null;
}

interface RealtimePayload {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: FAQPair;
  old: FAQPair;
  errors: null | string[];
}

export default function FAQGenerationStatus() {
  const [faqPairs, setFaqPairs] = useState<FAQPair[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    // Fetch FAQ pairs
    const fetchFaqPairs = async () => {
      const { data, error } = await supabase
        .from('construct_faq_pairs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching FAQ pairs:', error);
        return;
      }

      setFaqPairs(data || []);
      setLoading(false);
    };

    fetchFaqPairs();

    // Set up real-time subscription
    const channel = supabase
      .channel('faq_pairs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'construct_faq_pairs'
        },
        (payload: RealtimePayload) => {
          console.log('Change received!', payload);
          setFaqPairs(current => {
            const newPairs = [...current];
            const index = newPairs.findIndex(p => p.id === payload.new.id);
            if (index >= 0) {
              newPairs[index] = payload.new;
            } else {
              newPairs.push(payload.new);
            }
            return newPairs;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">FAQ Generation Status</h1>
      </div>

      {faqPairs.length === 0 ? (
        <Alert>
          <AlertDescription>
            No FAQ pairs found.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          {faqPairs.map((pair) => (
            <Card key={pair.id}>
              <CardHeader>
                <CardTitle>FAQ Pair {pair.id}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Request:</h3>
                    <p className="text-gray-600">{pair.ai_request_for_questions}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Response:</h3>
                    <p className="text-gray-600">
                      {pair.ai_response_questions || 'Waiting for response...'}
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push(`/faq-generation-status/${pair.id}`)}
                  >
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 