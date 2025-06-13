'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface FAQPair {
  id: string;
  construct_faq_pair_id: string;
  question: string;
  answer: string | null;
  status: string;
  created_at: string;
}

interface FAQDetailProps {
  id: string;
}

export default function FAQDetail({ id }: FAQDetailProps) {
  const [faqPairs, setFaqPairs] = useState<FAQPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    // Fetch FAQ pairs
    const fetchFaqPairs = async () => {
      const { data, error } = await supabase
        .from('client_faq_pairs')
        .select('*')
        .eq('construct_faq_pair_id', id)
        .order('created_at', { ascending: true });

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
          table: 'client_faq_pairs',
          filter: `construct_faq_pair_id=eq.${id}`
        }, 
        (payload) => {
          console.log('Change received!', payload);
          fetchFaqPairs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, id]);

  const handleAnswerChange = (id: string, answer: string) => {
    setFaqPairs(prev => 
      prev.map(pair => 
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
        status: pair.answer ? 'answered' : 'pending'
      }));

      const { error } = await supabase
        .from('client_faq_pairs')
        .upsert(updates);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving answers:', error);
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
        <Button 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Answers'
          )}
        </Button>
      </div>

      {faqPairs.length === 0 ? (
        <Alert>
          <AlertDescription>
            No questions found for this FAQ pair.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          {faqPairs.map((pair) => (
            <Card key={pair.id}>
              <CardHeader>
                <CardTitle>{pair.question}</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={pair.answer || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                    handleAnswerChange(pair.id, e.target.value)
                  }
                  placeholder="Enter your answer here..."
                  className="min-h-[100px]"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 