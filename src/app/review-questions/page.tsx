'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Question {
  id: string;
  construct_faq_pair_id: string;
  question_text: string;
  status: 'pending' | 'approved' | 'edited';
  edited_question: string | null;
  batch_id: string;
}

interface Batch {
  id: string;
  questions: Question[];
}

export default function ReviewQuestions() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedBatches, setSelectedBatches] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('review_questions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group questions by batch
      const batchMap = new Map<string, Question[]>();
      data.forEach((question: Question) => {
        const batchId = question.batch_id;
        if (!batchMap.has(batchId)) {
          batchMap.set(batchId, []);
        }
        batchMap.get(batchId)?.push(question);
      });

      // Convert to array of batches
      const batchArray = Array.from(batchMap.entries()).map(([id, questions]) => ({
        id,
        questions
      }));

      setBatches(batchArray);
    } catch (error) {
      console.error('Error fetching questions:', error);
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionEdit = async (batchId: string, questionId: string, newQuestion: string) => {
    try {
      const { error } = await supabase
        .from('review_questions')
        .update({
          edited_question: newQuestion,
          status: 'edited'
        })
        .eq('id', questionId);

      if (error) throw error;

      // Update local state
      setBatches(batches.map(batch => {
        if (batch.id === batchId) {
          return {
            ...batch,
            questions: batch.questions.map(q => 
              q.id === questionId ? { ...q, edited_question: newQuestion, status: 'edited' } : q
            )
          };
        }
        return batch;
      }));
    } catch (error) {
      console.error('Error updating question:', error);
      setError('Failed to update question');
    }
  };

  const handleApproveQuestion = async (batchId: string, questionId: string) => {
    try {
      const { error } = await supabase
        .from('review_questions')
        .update({ status: 'approved' })
        .eq('id', questionId);

      if (error) throw error;

      // Update local state
      setBatches(batches.map(batch => {
        if (batch.id === batchId) {
          return {
            ...batch,
            questions: batch.questions.filter(q => q.id !== questionId)
          };
        }
        return batch;
      }));
    } catch (error) {
      console.error('Error approving question:', error);
      setError('Failed to approve question');
    }
  };

  const handleApproveBatch = async (batchId: string) => {
    setSaving(true);
    try {
      // Get all question IDs in the batch
      const batch = batches.find(b => b.id === batchId);
      if (!batch) throw new Error('Batch not found');

      const questionIds = batch.questions.map(q => q.id);

      // Update all questions in the batch to approved
      const { error: updateError } = await supabase
        .from('review_questions')
        .update({ status: 'approved' })
        .in('id', questionIds);

      if (updateError) throw updateError;

      // Trigger the Answers Edge Function
      const { error: functionError } = await supabase.functions.invoke('generate_answers', {
        body: { batch_id: batchId }
      });

      if (functionError) throw functionError;

      // Remove the batch from local state
      setBatches(batches.filter(b => b.id !== batchId));
    } catch (error) {
      console.error('Error approving batch:', error);
      setError('Failed to approve batch');
    } finally {
      setSaving(false);
    }
  };

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
        <div className="text-center text-lg text-foreground">No questions pending review</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Review Questions</h1>
      
      <div className="space-y-8">
        {batches.map((batch) => (
          <div key={batch.id} className="bg-gray-800 p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-foreground">Batch {batch.id}</h2>
              <button
                onClick={() => handleApproveBatch(batch.id)}
                disabled={saving}
                className={`px-4 py-2 rounded-lg font-bold transition ${
                  saving ? 'bg-gray-600 text-white cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {saving ? 'Processing...' : 'Approve Batch & Generate Answers'}
              </button>
            </div>

            <div className="space-y-4">
              {batch.questions.map((question) => (
                <div key={question.id} className="bg-gray-700 p-4 rounded-lg">
                  <textarea
                    value={question.edited_question || question.question_text}
                    onChange={(e) => handleQuestionEdit(batch.id, question.id, e.target.value)}
                    className="w-full bg-gray-600 text-white rounded p-3 mb-3 min-h-[100px]"
                    placeholder="Edit question here..."
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleApproveQuestion(batch.id, question.id)}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded"
                    >
                      Approve Question
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 