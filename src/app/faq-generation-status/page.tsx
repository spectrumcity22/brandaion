'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface FAQPair {
  id: string;
  generation_status: string;
  error_message: string | null;
  created_at: string;
  batch_faq_pairs: number;
  ai_response_questions: string | null;
}

export default function FAQGenerationStatus() {
  const [faqPairs, setFaqPairs] = useState<FAQPair[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    const fetchFAQPairs = async () => {
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

    fetchFAQPairs();

    // Set up real-time subscription
    const channel = supabase
      .channel('faq_pairs_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'construct_faq_pairs' 
        }, 
        (payload) => {
          setFaqPairs(current => {
            const newPairs = [...current];
            const index = newPairs.findIndex(p => p.id === payload.new.id);
            if (index >= 0) {
              newPairs[index] = payload.new as FAQPair;
            } else {
              newPairs.unshift(payload.new as FAQPair);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'pending':
        return 'Pending';
      case 'generating_questions':
        return 'Generating Questions';
      case 'questions_generated':
        return 'Questions Generated';
      case 'generating_answers':
        return 'Generating Answers';
      default:
        return status;
    }
  };

  const handleViewQuestions = (faqPair: FAQPair) => {
    if (faqPair.generation_status === 'questions_generated' || faqPair.generation_status === 'completed') {
      router.push(`/faq-generation-status/${faqPair.id}`);
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
      <h1 className="text-3xl font-bold mb-8">FAQ Generation Status</h1>
      
      <div className="grid gap-6">
        {faqPairs.map((faqPair) => (
          <Card 
            key={faqPair.id}
            className={`cursor-pointer hover:bg-accent/50 transition-colors ${
              (faqPair.generation_status === 'questions_generated' || faqPair.generation_status === 'completed') 
                ? 'cursor-pointer' 
                : 'cursor-not-allowed'
            }`}
            onClick={() => handleViewQuestions(faqPair)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Batch {faqPair.batch_faq_pairs} FAQs
              </CardTitle>
              <div className="flex items-center space-x-2">
                {getStatusIcon(faqPair.generation_status)}
                <span className="text-sm font-medium">
                  {getStatusText(faqPair.generation_status)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Created: {new Date(faqPair.created_at).toLocaleString()}
              </div>
              {faqPair.error_message && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{faqPair.error_message}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 