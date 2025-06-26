'use client';
import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Button, 
  Card, 
  TextField, 
  Typography, 
  Box, 
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Stack,
  Container,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody
} from '@mui/material';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ReviewAnswer {
  id: number;
  topic: string;
  question: string;
  ai_response_answers: string;
  answer_status: string;
  unique_batch_id: string;
  unique_batch_cluster: string;
  organisation: string;
  product_name: string;
  audience_name: string;
  batch_faq_pairs: string;
}

interface BatchGroup {
  batchId: string;
  batchCluster: string;
  answers: ReviewAnswer[];
}

export default function ReviewAnswers() {
  const [answers, setAnswers] = useState<ReviewAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, boolean>>({});
  const [editingAnswers, setEditingAnswers] = useState<Record<number, string>>({});
  const [processingBatches, setProcessingBatches] = useState<Record<string, boolean>>({});
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetchAnswers();
    // Get user on component load
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    })();
  }, []);

  const fetchAnswers = async () => {
    try {
      // Get current user first
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!user || authError) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('review_questions')
        .select('id, topic, question, ai_response_answers, answer_status, unique_batch_id, unique_batch_cluster, organisation, product_name, audience_name, batch_faq_pairs')
        .eq('auth_user_id', user.id) // Filter by current user
        .eq('answer_status', 'completed')
        .not('ai_response_answers', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAnswers(data || []);
    } catch (error) {
      setError('Failed to load answers');
    } finally {
      setLoading(false);
    }
  };

  // Group answers by batch
  const groupedAnswers = answers.reduce((groups: BatchGroup[], answer) => {
    const batchId = answer.unique_batch_id || 'No Batch';
    const batchCluster = answer.unique_batch_cluster || 'No Cluster';
    
    const existingGroup = groups.find(g => g.batchId === batchId);
    if (existingGroup) {
      existingGroup.answers.push(answer);
    } else {
      groups.push({
        batchId,
        batchCluster,
        answers: [answer]
      });
    }
    return groups;
  }, []);

  const handleSelectAll = (checked: boolean) => {
    const newSelected: Record<number, boolean> = {};
    answers.forEach(answer => {
      if (answer.answer_status === 'completed') {
        newSelected[answer.id] = checked;
      }
    });
    setSelectedAnswers(newSelected);
  };

  const handleSelectAnswer = (id: number, checked: boolean) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [id]: checked
    }));
  };

  const handleEditAnswer = (id: number, newAnswer: string) => {
    setEditingAnswers(prev => ({
      ...prev,
      [id]: newAnswer
    }));
  };

  const handleSaveEdit = async (id: number) => {
    try {
      const newAnswer = editingAnswers[id];
      if (!newAnswer) return;

      const { error: updateError } = await supabase
        .from('review_questions')
        .update({ ai_response_answers: newAnswer })
        .eq('id', id);

      if (updateError) throw updateError;

      // Update local state
      setAnswers(prev => prev.map(a => 
        a.id === id ? { ...a, ai_response_answers: newAnswer } : a
      ));

      // Clear editing state
      setEditingAnswers(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
    } catch (error) {
      console.error('Error updating answer:', error);
      setError('Failed to update answer');
    }
  };

  const handleApproveAnswer = async (id: number) => {
    try {
      const { error: updateError } = await supabase
        .from('review_questions')
        .update({ answer_status: 'approved' })
        .eq('id', id);

      if (updateError) throw updateError;

      // Update local state
      setAnswers(prev => prev.map(a => 
        a.id === id ? { ...a, answer_status: 'approved' } : a
      ));

      // Clear selection
      setSelectedAnswers(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
    } catch (error) {
      console.error('Error approving answer:', error);
      setError('Failed to approve answer');
    }
  };

  const handleApproveSelected = async () => {
    try {
      const selectedIds = Object.entries(selectedAnswers)
        .filter(([_, selected]) => selected)
        .map(([id]) => parseInt(id));

      // Update selected answers to approved
      const { error: updateError } = await supabase
        .from('review_questions')
        .update({ answer_status: 'approved' })
        .in('id', selectedIds);

      if (updateError) throw updateError;

      // Refresh the answers list
      fetchAnswers();
      setSelectedAnswers({});
    } catch (error) {
      console.error('Error approving answers:', error);
      setError('Failed to approve answers');
    }
  };

  const handleProcessBatch = async (batchId: string) => {
    try {
      setProcessingBatches(prev => ({ ...prev, [batchId]: true }));
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const response = await fetch("https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/generate-faq-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          unique_batch_id: batchId,
          auth_user_id: user.id 
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Batch processing failed:", errorText);
        setError('Failed to process batch. Please try again.');
      } else {
        const result = await response.json();
        console.log('Batch processed successfully:', result);
        // Refresh data to show updated status
        await fetchAnswers();
      }

    } catch (error) {
      console.error("Error processing batch:", error);
      setError('Failed to process batch. Please try again.');
    } finally {
      setProcessingBatches(prev => ({ ...prev, [batchId]: false }));
    }
  };

  const isBatchComplete = (batch: BatchGroup) => {
    return batch.answers.every(answer => answer.answer_status === 'approved');
  };

  const getApprovedCount = (batch: BatchGroup) => {
    return batch.answers.filter(answer => answer.answer_status === 'approved').length;
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

  return (
    <div className="max-w-6xl mx-auto mt-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Review Answers</h1>
      <div className="mb-4">
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleApproveSelected}
          disabled={Object.values(selectedAnswers).every(v => !v)}
        >
          Approve Selected
        </Button>
      </div>
      
      {groupedAnswers.map((batch, batchIndex) => {
        const isComplete = isBatchComplete(batch);
        const approvedCount = getApprovedCount(batch);
        const totalCount = batch.answers.length;
        
        return (
          <div key={batch.batchId} className="mb-8">
            <div className="bg-gray-800 p-4 rounded-t-lg">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Batch ID: {batch.batchId}
                </h2>
                <p className="text-gray-300">Cluster: {batch.batchCluster}</p>
                <p className="text-gray-300">
                  Progress: {approvedCount}/{totalCount} answers approved
                </p>
              </div>
            </div>
            
            <table className="w-full text-left border-separate border-spacing-y-2 bg-gray-900 rounded-b-lg">
              <thead>
                <tr>
                  <th className="text-foreground font-semibold py-2 px-4">
                    <Checkbox
                      onChange={(e) => {
                        const newSelected = { ...selectedAnswers };
                        batch.answers.forEach(a => {
                          if (a.answer_status === 'completed') {
                            newSelected[a.id] = e.target.checked;
                          }
                        });
                        setSelectedAnswers(newSelected);
                      }}
                      checked={batch.answers.some(a => 
                        a.answer_status === 'completed' && selectedAnswers[a.id]
                      )}
                    />
                  </th>
                  <th className="text-foreground font-semibold py-2 px-4">Topic</th>
                  <th className="text-foreground font-semibold py-2 px-4">Question</th>
                  <th className="text-foreground font-semibold py-2 px-4">Answer</th>
                  <th className="text-foreground font-semibold py-2 px-4">Actions</th>
                  <th className="text-foreground font-semibold py-2 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {batch.answers.map((answer) => {
                  const isApproved = answer.answer_status === 'approved';
                  const isEditing = editingAnswers.hasOwnProperty(answer.id);
                  
                  return (
                    <tr 
                      key={answer.id} 
                      className={`border-b border-gray-700 ${
                        isApproved ? 'bg-gray-800' : 'bg-transparent'
                      }`}
                    >
                      <td className="text-foreground py-1 px-4">
                        {!isApproved && (
                          <Checkbox
                            checked={!!selectedAnswers[answer.id]}
                            onChange={(e) => handleSelectAnswer(answer.id, e.target.checked)}
                          />
                        )}
                      </td>
                      <td className="text-foreground py-1 px-4 align-top w-1/6">
                        {answer.topic}
                      </td>
                      <td className="text-foreground py-1 px-4 align-top w-1/6">
                        {answer.question}
                      </td>
                      <td className="text-foreground py-1 px-4 align-top w-2/5">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <textarea
                              value={editingAnswers[answer.id]}
                              onChange={(e) => handleEditAnswer(answer.id, e.target.value)}
                              className="flex-1 bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 min-h-[100px]"
                            />
                            <button
                              onClick={() => handleSaveEdit(answer.id)}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div className="p-2 bg-green-900 rounded text-sm">
                            {answer.ai_response_answers}
                          </div>
                        )}
                      </td>
                      <td className="text-foreground py-1 px-4 align-top w-1/6">
                        {!isApproved && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditAnswer(answer.id, answer.ai_response_answers)}
                              className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleApproveAnswer(answer.id)}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                            >
                              Approve
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="text-foreground py-1 px-4 align-top w-1/6">
                        {isApproved ? (
                          <div className="flex items-center gap-2">
                            <span className="text-green-400">✓ Approved</span>
                          </div>
                        ) : (
                          <span className="text-yellow-400">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {isComplete && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => handleProcessBatch(batch.batchId)}
                  disabled={processingBatches[batch.batchId]}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {processingBatches[batch.batchId] ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : 'Process Batch'}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
} 