'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface FAQPair {
  id: string;
  question: string;
  answer: string | null;
  status: string;
  construct_faq_pair_id: string;
}

export default function FAQPairDetail({ params }: { params: { id: string } }) {
  const [faqPairs, setFaqPairs] = useState<FAQPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    const fetchFAQPairs = async () => {
      const { data, error } = await supabase
        .from('client_faq_pairs')
        .select('*')
        .eq('construct_faq_pair_id', params.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching FAQ pairs:', error);
        return;
      }

      setFaqPairs(data || []);
      setLoading(false);
    };

    fetchFAQPairs();

    // Set up real-time subscription
    const channel = supabase
      .channel('client_faq_pairs_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'client_faq_pairs',
          filter: `construct_faq_pair_id=eq.${params.id}`
        }, 
        (payload) => {
          setFaqPairs(current => {
            const newPairs = [...current];
            const index = newPairs.findIndex(p => p.id === payload.new.id);
            if (index >= 0) {
              newPairs[index] = payload.new as FAQPair;
            } else {
              newPairs.push(payload.new as FAQPair);
            }
            return newPairs;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, params.id]);

  const handleAnswerChange = (id: string, answer: string) => {
    setFaqPairs(current =>
      current.map(pair =>
        pair.id === id ? { ...pair, answer } : pair
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = faqPairs.map(pair => ({
        id: pair.id,
        answer: pair.answer,
        status: pair.answer ? 'completed' : 'pending'
      }));

      const { error } = await supabase
        .from('client_faq_pairs')
        .upsert(updates);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving FAQ pairs:', error);
    } finally {
      setSaving(false);
    }
  };

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
        <h1 className="text-3xl font-bold">FAQ Questions</h1>
        <div className="space-x-4">
          <Button variant="outline" onClick={() => router.back()}>
            Back
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </div>
      </div>
      
      <div className="grid gap-6">
        {faqPairs.map((faqPair) => (
          <Card key={faqPair.id}>
            <CardHeader>
              <CardTitle className="text-lg">{faqPair.question}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter your answer here..."
                value={faqPair.answer || ''}
                onChange={(e) => handleAnswerChange(faqPair.id, e.target.value)}
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 