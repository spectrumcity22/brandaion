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

interface ReviewQuestion {
  id: number;
  topic: string;
  question: string;
  question_status: string;
  unique_batch_id: string;
  unique_batch_cluster: string;
  answer_status?: string;
  ai_response_answers?: string;
}

interface BatchGroup {
  batchId: string;
  batchCluster: string;
  questions: ReviewQuestion[];
}

export default function ReviewQuestions() {
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<Record<number, boolean>>({});
  const [editingQuestions, setEditingQuestions] = useState<Record<number, string>>({});
  const [askingQuestions, setAskingQuestions] = useState<Record<number, boolean>>({});
  const [user, setUser] = useState<any>(null);
  const [pendingBatches, setPendingBatches] = useState<any[]>([]);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);

  useEffect(() => {
    fetchQuestions();
    fetchPendingBatches();
    // Get user on component load (following client_configuration_form pattern)
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    })();
  }, []);

  const fetchQuestions = async () => {
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
        .select('id, topic, question, question_status, unique_batch_id, unique_batch_cluster, answer_status, ai_response_answers')
        .eq('auth_user_id', user.id) // Filter by current user
        .in('question_status', ['questions_generated', 'question_approved'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      setQuestions(data || []);
    } catch (error) {
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingBatches = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!user || authError) return;

      const { data, error } = await supabase
        .from('construct_faq_pairs')
        .select('unique_batch_id, unique_batch_cluster, batch_date, organisation')
        .eq('auth_user_id', user.id)
        .eq('question_status', 'pending')
        .is('ai_response_questions', null)
        .order('batch_date', { ascending: false });

      if (error) throw error;
      setPendingBatches(data || []);
    } catch (error) {
      console.error('Error fetching pending batches:', error);
    }
  };

  const handleGenerateQuestions = async () => {
    setGeneratingQuestions(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      // Generate questions for each pending batch
      for (const batch of pendingBatches) {
        const response = await fetch("https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/open_ai_request_questions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "x-client-info": "supabase-js/2.39.3",
            "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          },
          body: JSON.stringify({ batchId: batch.unique_batch_id }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`Failed to generate questions for batch ${batch.unique_batch_id}:`, errorData);
        }
      }

      // Refresh data after generation
      await fetchQuestions();
      await fetchPendingBatches();
    } catch (error) {
      console.error('Error generating questions:', error);
      setError('Failed to generate questions. Please try again.');
    } finally {
      setGeneratingQuestions(false);
    }
  };

  // Group questions by batch
  const groupedQuestions = questions.reduce((groups: BatchGroup[], question) => {
    const batchId = question.unique_batch_id || 'No Batch';
    const batchCluster = question.unique_batch_cluster || 'No Cluster';
    
    const existingGroup = groups.find(g => g.batchId === batchId);
    if (existingGroup) {
      existingGroup.questions.push(question);
    } else {
      groups.push({
        batchId,
        batchCluster,
        questions: [question]
      });
    }
    return groups;
  }, []);

  const handleSelectAll = (checked: boolean) => {
    const newSelected: Record<number, boolean> = {};
    questions.forEach(question => {
      if (question.question_status === 'questions_generated') {
        newSelected[question.id] = checked;
      }
    });
    setSelectedQuestions(newSelected);
  };

  const handleSelectQuestion = (id: number, checked: boolean) => {
    setSelectedQuestions(prev => ({
      ...prev,
      [id]: checked
    }));
  };

  const handleEditQuestion = (id: number, newQuestion: string) => {
    setEditingQuestions(prev => ({
      ...prev,
      [id]: newQuestion
    }));
  };

  const handleSaveEdit = async (id: number) => {
    try {
      const newQuestion = editingQuestions[id];
      if (!newQuestion) return;

      const { error: updateError } = await supabase
        .from('review_questions')
        .update({ question: newQuestion })
        .eq('id', id);

      if (updateError) throw updateError;

      // Update local state
      setQuestions(prev => prev.map(q => 
        q.id === id ? { ...q, question: newQuestion } : q
      ));

      // Clear editing state
      setEditingQuestions(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
    } catch (error) {
      console.error('Error updating question:', error);
      setError('Failed to update question');
    }
  };

  const handleApproveQuestion = async (id: number) => {
    try {
      const { error: updateError } = await supabase
        .from('review_questions')
        .update({ question_status: 'question_approved' })
        .eq('id', id);

      if (updateError) throw updateError;

      // Update local state
      setQuestions(prev => prev.map(q => 
        q.id === id ? { ...q, question_status: 'question_approved' } : q
      ));

      // Clear selection
      setSelectedQuestions(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
    } catch (error) {
      console.error('Error approving question:', error);
      setError('Failed to approve question');
    }
  };

  const handleApproveSelected = async () => {
    try {
      const selectedIds = Object.entries(selectedQuestions)
        .filter(([_, selected]) => selected)
        .map(([id]) => parseInt(id));

      // Update selected questions to approved
      const { error: updateError } = await supabase
        .from('review_questions')
        .update({ question_status: 'question_approved' })
        .in('id', selectedIds);

      if (updateError) throw updateError;

      // Refresh the questions list
      fetchQuestions();
      setSelectedQuestions({});
    } catch (error) {
      console.error('Error approving questions:', error);
      setError('Failed to approve questions');
    }
  };

  const handleAskQuestion = async (questionId: number) => {
    setAskingQuestions(prev => ({ ...prev, [questionId]: true }));
    setError(null); 

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const response = await fetch("https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/ai_request_answers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          question_id: questionId,
          auth_user_id: user.id 
        }),
      });

      if (!response.ok) {
        // The function might return an error, log it, but don't show a breaking error to the user
        const errorText = await response.text();
        console.error("API call failed but proceeding with data refresh:", errorText);
      }

    } catch (error) {
        console.error("Error asking question:", error)
        // We don't set a user-facing error here. The source of truth is the data refetch.
    } finally {
        // Always refresh data to get the latest status. This is the source of truth.
        await fetchQuestions(); 
        setAskingQuestions(prev => ({ ...prev, [questionId]: false }));
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

  return (
    <div className="max-w-6xl mx-auto mt-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Review Questions</h1>
      
      {/* Generate Questions Section - Always Show */}
      <div className="mb-8 p-6 bg-blue-900/20 border border-blue-500/30 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white mb-2">Generate Questions</h2>
            <p className="text-gray-300">
              {pendingBatches.length > 0 
                ? `You have ${pendingBatches.length} batch${pendingBatches.length > 1 ? 'es' : ''} ready for question generation.`
                : 'No pending batches found. Please complete your configuration first.'
              }
            </p>
          </div>
          <Button
            variant="contained"
            color="primary"
            onClick={handleGenerateQuestions}
            disabled={generatingQuestions || pendingBatches.length === 0}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50"
          >
            {generatingQuestions ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generating...
              </div>
            ) : (
              pendingBatches.length > 0 
                ? `Generate Questions (${pendingBatches.length})`
                : 'No Batches Available'
            )}
          </Button>
        </div>
        
        {/* Pending Batches List */}
        {pendingBatches.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingBatches.map((batch) => (
              <div key={batch.unique_batch_id} className="bg-gray-800/50 border border-gray-600/50 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Batch ID</div>
                <div className="text-white font-mono text-xs mb-2">{batch.unique_batch_id}</div>
                <div className="text-sm text-gray-400 mb-1">Organisation</div>
                <div className="text-white">{batch.organisation}</div>
                <div className="text-sm text-gray-400 mb-1">Date</div>
                <div className="text-white">{new Date(batch.batch_date).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
        
        {pendingBatches.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">No pending batches found</div>
            <div className="text-sm text-gray-500">
              Complete your AI configuration to create FAQ batches for question generation.
            </div>
          </div>
        )}
      </div>

      {/* Existing Questions Section - Always Show */}
      <div className="mb-8 p-6 bg-gray-900/20 border border-gray-700/30 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Review Generated Questions</h2>
          {questions.length > 0 && (
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleApproveSelected}
              disabled={Object.values(selectedQuestions).every(v => !v)}
            >
              Approve Selected
            </Button>
          )}
        </div>
        
        {questions.length > 0 ? (
          <>
            {groupedQuestions.map((batch, batchIndex) => (
              <div key={batch.batchId} className="mb-8">
                <div className="bg-gray-800 p-4 rounded-t-lg">
                  <h3 className="text-lg font-semibold text-white">
                    Batch ID: {batch.batchId}
                  </h3>
                  <p className="text-gray-300">Cluster: {batch.batchCluster}</p>
                </div>
                
                <table className="w-full text-left border-separate border-spacing-y-2 bg-gray-900 rounded-b-lg">
                  <thead>
                    <tr>
                      <th className="text-foreground font-semibold py-2 px-4">
                        <Checkbox
                          onChange={(e) => {
                            const newSelected = { ...selectedQuestions };
                            batch.questions.forEach(q => {
                              if (q.question_status === 'questions_generated') {
                                newSelected[q.id] = e.target.checked;
                              }
                            });
                            setSelectedQuestions(newSelected);
                          }}
                          checked={batch.questions.some(q => 
                            q.question_status === 'questions_generated' && selectedQuestions[q.id]
                          )}
                        />
                      </th>
                      <th className="text-foreground font-semibold py-2 px-4">Topic</th>
                      <th className="text-foreground font-semibold py-2 px-4">Question</th>
                      <th className="text-foreground font-semibold py-2 px-4">Actions</th>
                      <th className="text-foreground font-semibold py-2 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.questions.map((question) => {
                      const isApproved = question.question_status === 'question_approved';
                      const isEditing = editingQuestions.hasOwnProperty(question.id);
                      
                      return (
                        <tr 
                          key={question.id} 
                          className={`border-b border-gray-700 ${
                            isApproved ? 'bg-gray-800' : 'bg-transparent'
                          }`}
                        >
                          <td className="text-foreground py-1 px-4">
                            {!isApproved && (
                              <Checkbox
                                checked={!!selectedQuestions[question.id]}
                                onChange={(e) => handleSelectQuestion(question.id, e.target.checked)}
                              />
                            )}
                          </td>
                          <td className="text-foreground py-1 px-4 align-top w-1/6">
                            {question.topic}
                          </td>
                          <td className="text-foreground py-1 px-4 align-top w-2/5">
                            {isEditing ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editingQuestions[question.id]}
                                  onChange={(e) => handleEditQuestion(question.id, e.target.value)}
                                  className="flex-1 bg-gray-800 text-white border border-gray-600 rounded px-2 py-1"
                                />
                                <button
                                  onClick={() => handleSaveEdit(question.id)}
                                  className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <div>
                                <span>{question.question}</span>
                                {question.ai_response_answers && (
                                  <div className="mt-2 p-2 bg-green-900 rounded text-sm">
                                    {question.ai_response_answers}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="text-foreground py-1 px-4 align-top w-1/6">
                            {!isApproved && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditQuestion(question.id, question.question)}
                                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleApproveQuestion(question.id)}
                                  className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                                >
                                  Approve
                                </button>
                              </div>
                            )}
                            {isApproved && (
                              <div className="flex gap-2">
                                {!question.ai_response_answers && question.answer_status !== 'completed' ? (
                                  <button
                                    onClick={() => handleAskQuestion(question.id)}
                                    disabled={askingQuestions[question.id] || question.answer_status === 'generating'}
                                    className={`px-3 py-1 rounded text-sm ${
                                      askingQuestions[question.id] 
                                        ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
                                        : 'bg-purple-600 text-white hover:bg-purple-700'
                                    }`}
                                  >
                                    {askingQuestions[question.id] ? (
                                      <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                        </svg>
                                        Thinking...
                                      </span>
                                    ) : 'Ask Question'}
                                  </button>
                                ) : (
                                  <span className="text-green-400 text-sm">✓ Answered</span>
                                )}
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
              </div>
            ))}
          </>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">No questions generated yet</div>
            <div className="text-sm text-gray-500">
              Generate questions using the button above to start reviewing and approving your FAQ content.
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 