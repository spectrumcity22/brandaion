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
  Chip
} from '@mui/material';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface FAQPair {
  id: number;
  topic: string;
  question: string;
  ai_response_answers: string;
  question_status: string;
  answer_status: string;
  unique_batch_id: string;
  unique_batch_cluster: string;
  organisation: string;
  product_name: string;
  audience_name: string;
  batch_faq_pairs?: string;
}

interface BatchGroup {
  batchId: string;
  batchCluster: string;
  faqPairs: FAQPair[];
}

export default function FAQManagement() {
  const [faqPairs, setFaqPairs] = useState<FAQPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [pendingBatches, setPendingBatches] = useState<any[]>([]);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Record<number, string>>({});
  const [editingQuestion, setEditingQuestion] = useState<Record<number, string>>({});
  const [editingAnswer, setEditingAnswer] = useState<Record<number, string>>({});
  const [approvingQuestions, setApprovingQuestions] = useState<Record<number, boolean>>({});
  const [approvingAnswers, setApprovingAnswers] = useState<Record<number, boolean>>({});
  const [batchApproving, setBatchApproving] = useState<Record<string, boolean>>({});
  const [aiRefineModalOpen, setAiRefineModalOpen] = useState(false);
  const [aiRefinePrompt, setAiRefinePrompt] = useState('');
  const [aiRefineTargetId, setAiRefineTargetId] = useState<number | null>(null);
  const [aiRefineLoading, setAiRefineLoading] = useState(false);
  const [aiRefineImprovedQuestion, setAiRefineImprovedQuestion] = useState('');
  const [aiRefineStep, setAiRefineStep] = useState<'prompt' | 'result'>('prompt');

  useEffect(() => {
    fetchFaqPairs();
    fetchPendingBatches();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    })();
  }, []);

  const fetchFaqPairs = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!user || authError) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('review_questions')
        .select('id, topic, question, ai_response_answers, question_status, answer_status, unique_batch_id, unique_batch_cluster, organisation, product_name, audience_name, batch_faq_pairs')
        .eq('auth_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFaqPairs(data || []);
    } catch (error) {
      setError('Failed to load FAQ pairs');
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

  const handleGenerateQuestions = async (type: 'faq' | 'conversational') => {
    setGeneratingQuestions(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      for (const batch of pendingBatches) {
        const response = await fetch("https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/open_ai_request_questions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "x-client-info": "supabase-js/2.39.3",
            "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          },
          body: JSON.stringify({ 
            batchId: batch.unique_batch_id,
            questionType: type 
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`Failed to generate ${type} questions for batch ${batch.unique_batch_id}:`, errorData);
        }
      }

      await fetchFaqPairs();
      await fetchPendingBatches();
    } catch (error) {
      console.error('Error generating questions:', error);
      setError('Failed to generate questions. Please try again.');
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const handleSaveEdit = async (id: number, field: 'topic' | 'question' | 'answer', value: string) => {
    try {
      const updateData = field === 'answer' 
        ? { ai_response_answers: value }
        : { [field]: value };

      const { error: updateError } = await supabase
        .from('review_questions')
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;

      setFaqPairs(prev => prev.map(faq => 
        faq.id === id ? { ...faq, [field]: value } : faq
      ));

      if (field === 'topic') {
        setEditingTopic(prev => { const newState = { ...prev }; delete newState[id]; return newState; });
      } else if (field === 'question') {
        setEditingQuestion(prev => { const newState = { ...prev }; delete newState[id]; return newState; });
      } else {
        setEditingAnswer(prev => { const newState = { ...prev }; delete newState[id]; return newState; });
      }
    } catch (error) {
      console.error('Error updating FAQ:', error);
      setError('Failed to update FAQ');
    }
  };

  const handleApproveQuestion = async (id: number) => {
    try {
      setApprovingQuestions(prev => ({ ...prev, [id]: true }));
      
      const { error: updateError } = await supabase
        .from('review_questions')
        .update({ question_status: 'question_approved' })
        .eq('id', id);

      if (updateError) throw updateError;

      setFaqPairs(prev => prev.map(faq => 
        faq.id === id ? { ...faq, question_status: 'question_approved' } : faq
      ));

      // Generate answer automatically
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetch("https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/ai_request_answers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ question_id: id, auth_user_id: session.user.id }),
        });
      }

      await fetchFaqPairs();
    } catch (error) {
      console.error('Error approving question:', error);
      setError('Failed to approve question');
    } finally {
      setApprovingQuestions(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleApproveAnswer = async (id: number) => {
    try {
      setApprovingAnswers(prev => ({ ...prev, [id]: true }));
      
      const { error: updateError } = await supabase
        .from('review_questions')
        .update({ answer_status: 'approved' })
        .eq('id', id);

      if (updateError) throw updateError;

      setFaqPairs(prev => prev.map(faq => 
        faq.id === id ? { ...faq, answer_status: 'approved' } : faq
      ));
    } catch (error) {
      console.error('Error approving answer:', error);
      setError('Failed to approve answer');
    } finally {
      setApprovingAnswers(prev => ({ ...prev, [id]: false }));
    }
  };

  // Group FAQ pairs by batch
  const groupedFaqPairs = faqPairs.reduce((groups: BatchGroup[], faq) => {
    const batchId = faq.unique_batch_id || 'No Batch';
    const batchCluster = faq.unique_batch_cluster || 'No Cluster';
    
    const existingGroup = groups.find(g => g.batchId === batchId);
    if (existingGroup) {
      existingGroup.faqPairs.push(faq);
    } else {
      groups.push({
        batchId,
        batchCluster,
        faqPairs: [faq]
      });
    }
    return groups;
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'question_approved':
        return 'bg-green-600 text-white border-green-400';
      case 'approved':
        return 'bg-green-600 text-white border-green-400';
      case 'pending':
        return 'bg-amber-500 text-white border-amber-400';
      default:
        return 'bg-gray-700 text-gray-300 border-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'question_approved':
        return 'Question Approved';
      case 'approved':
        return 'Answer Approved';
      case 'completed':
        return 'Answer Ready';
      case 'pending':
        return 'Pending';
      default:
        return status;
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
      <div className="max-w-6xl mx-auto mt-8">
        <div className="bg-red-900 text-red-200 p-4 rounded">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto mt-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-white">FAQ Management</h1>
      
      {/* Generate Questions Panel */}
      <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Generate Questions</h2>
            <p className="text-gray-400">Choose your question generation strategy based on your content needs</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* FAQ Generation Card */}
          <div className="bg-gray-800/50 border border-gray-600/50 rounded-xl p-6 hover:border-gray-500/50 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <Chip 
                label="Product Discovery" 
                className="bg-blue-600/80 text-white border-blue-400/80" 
                size="small" 
                style={{ color: '#fff' }}
              />
            </div>
            
            <h3 className="text-xl font-semibold text-white mb-3">Generate FAQs</h3>
            <p className="text-gray-300 mb-4">
              Create traditional FAQ questions focused on common customer inquiries, product features, 
              pricing, and support topics. Perfect for customer service and support documentation.
            </p>
            
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Customer support focused
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Product and service information
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Pricing and policy details
              </div>
            </div>

            <Button
              variant="contained"
              color="primary"
              onClick={() => handleGenerateQuestions('faq')}
              disabled={generatingQuestions || pendingBatches.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              style={{ color: '#fff' }}
            >
              {generatingQuestions ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  Generating FAQs...
                </span>
              ) : (
                `Generate FAQs (${pendingBatches.length} batches)`
              )}
            </Button>
          </div>

          {/* Conversational Questions Card */}
          <div className="bg-gray-800/50 border border-gray-600/50 rounded-xl p-6 hover:border-gray-500/50 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <Chip 
                label="Brand Discovery" 
                className="bg-purple-600/80 text-white border-purple-400/80" 
                size="small" 
                style={{ color: '#fff' }}
              />
            </div>
            
            <h3 className="text-xl font-semibold text-white mb-3">Generate Conversational Questions</h3>
            <p className="text-gray-300 mb-4">
              Create strategic, thought-provoking questions that explore business impact, competitive advantages, 
              and strategic insights. Ideal for sales conversations and strategic planning.
            </p>
            
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Strategic business insights
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Competitive advantage exploration
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Sales and marketing support
              </div>
            </div>

            <Button
              variant="contained"
              color="secondary"
              onClick={() => handleGenerateQuestions('conversational')}
              disabled={generatingQuestions || pendingBatches.length === 0}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              style={{ color: '#fff' }}
            >
              {generatingQuestions ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  Generating Questions...
                </span>
              ) : (
                `Generate Conversational (${pendingBatches.length} batches)`
              )}
            </Button>
          </div>
        </div>

        {pendingBatches.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">No pending batches found</div>
            <div className="text-sm text-gray-500">
              Complete your AI configuration to create FAQ batches for question generation.
            </div>
          </div>
        )}
      </div>

      {/* FAQ Pairs Management */}
      {groupedFaqPairs.length > 0 && (
        <div className="space-y-8">
          {groupedFaqPairs.map((batch) => {
            const approvedQuestions = batch.faqPairs.filter(faq => faq.question_status === 'question_approved').length;
            const totalQuestions = batch.faqPairs.length;
            
            return (
              <div key={batch.batchId} className="bg-gray-900/20 border border-gray-700/30 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      Batch: {batch.batchId}
                    </h3>
                    <p className="text-gray-400">Cluster: {batch.batchCluster}</p>
                    <p className="text-gray-400">
                      Progress: {approvedQuestions}/{totalQuestions} questions approved
                    </p>
                  </div>
                  
                  {/* Batch Approve Button */}
                  {batch.faqPairs.every(q => q.question_status === 'question_approved') ? (
                    <div className="bg-gray-600/50 border border-gray-500/50 rounded-lg px-6 py-2 text-lg font-bold flex items-center gap-2 text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Batch Approved
                    </div>
                  ) : (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={async () => {
                        setBatchApproving(prev => ({ ...prev, [batch.batchId]: true }));
                        const idsToApprove = batch.faqPairs
                          .filter(q => q.question_status !== 'question_approved')
                          .map(q => q.id);
                        if (idsToApprove.length === 0) {
                          setBatchApproving(prev => ({ ...prev, [batch.batchId]: false }));
                          return;
                        }
                        const { error: updateError } = await supabase
                          .from('review_questions')
                          .update({ question_status: 'question_approved' })
                          .in('id', idsToApprove);
                        if (updateError) {
                          setError('Failed to approve batch questions');
                          setBatchApproving(prev => ({ ...prev, [batch.batchId]: false }));
                          return;
                        }
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) {
                          setError('No active session');
                          setBatchApproving(prev => ({ ...prev, [batch.batchId]: false }));
                          return;
                        }
                        for (const id of idsToApprove) {
                          const response = await fetch("https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/ai_request_answers", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              "Authorization": `Bearer ${session.access_token}`,
                            },
                            body: JSON.stringify({ question_id: id, auth_user_id: session.user.id }),
                          });
                          if (!response.ok) {
                            const errorText = await response.text();
                            setError(`Failed to trigger answer generation for question ${id}: ${errorText}`);
                            setBatchApproving(prev => ({ ...prev, [batch.batchId]: false }));
                            return;
                          }
                        }
                        await fetchFaqPairs();
                        setBatchApproving(prev => ({ ...prev, [batch.batchId]: false }));
                      }}
                      className="ml-4 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 shadow-lg px-6 py-2 rounded-lg text-lg font-bold flex items-center gap-2"
                      disabled={batchApproving[batch.batchId]}
                      style={{ color: '#fff' }}
                    >
                      {batchApproving[batch.batchId] ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                          </svg>
                          Approving...
                        </span>
                      ) : 'Approve All in Batch'}
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  {batch.faqPairs.map((faq) => (
                    <div key={faq.id} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Topic Card */}
                      <div className={`bg-gray-800/50 border border-gray-600/50 rounded-lg p-4 text-left h-full ${faq.ai_response_answers ? 'h-[480px]' : 'h-[160px]'}`}>
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Topic</h4>
                          <button
                            onClick={() => setEditingTopic(prev => ({ ...prev, [faq.id]: faq.topic }))}
                            className="text-gray-400 hover:text-white transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                        </div>
                        
                        {editingTopic[faq.id] !== undefined ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingTopic[faq.id]}
                              onChange={(e) => setEditingTopic(prev => ({ ...prev, [faq.id]: e.target.value }))}
                              className={`w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 text-sm ${faq.ai_response_answers ? 'h-[340px]' : 'h-[100px]'}`}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveEdit(faq.id, 'topic', editingTopic[faq.id])}
                                className="bg-green-600 text-white px-3 py-1 rounded text-xs"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingTopic(prev => { const newState = { ...prev }; delete newState[faq.id]; return newState; })}
                                className="bg-gray-600 text-white px-3 py-1 rounded text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-white text-sm">{faq.topic}</p>
                        )}
                      </div>

                      {/* Question Card */}
                      <div className={`bg-gray-800/50 border border-gray-600/50 rounded-lg p-4 text-left h-full ${faq.ai_response_answers ? 'h-[480px]' : 'h-[160px]'}`}>
                        <div className="flex items-start justify-between w-full mb-3">
                          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Question</h4>
                          <button
                            onClick={() => setEditingQuestion(prev => ({ ...prev, [faq.id]: faq.question }))}
                            className="text-gray-400 hover:text-white transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                        </div>
                        
                        {editingQuestion[faq.id] !== undefined ? (
                          <div className="flex flex-col w-full">
                            <textarea
                              value={editingQuestion[faq.id]}
                              onChange={(e) => setEditingQuestion(prev => ({ ...prev, [faq.id]: e.target.value }))}
                              className={`w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 text-sm ${faq.ai_response_answers ? 'h-[340px]' : 'h-[100px]'}`}
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => handleSaveEdit(faq.id, 'question', editingQuestion[faq.id])}
                                className="bg-green-600 text-white px-3 py-1 rounded text-xs"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setAiRefineModalOpen(true);
                                  setAiRefineTargetId(faq.id);
                                  setAiRefinePrompt('');
                                  setAiRefineStep('prompt');
                                  setAiRefineImprovedQuestion('');
                                }}
                                className="bg-blue-500 text-white px-3 py-1 rounded text-xs"
                              >
                                Refine with AI
                              </button>
                              <button
                                onClick={() => setEditingQuestion(prev => { const newState = { ...prev }; delete newState[faq.id]; return newState; })}
                                className="bg-gray-600 text-white px-3 py-1 rounded text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-white text-sm mb-4">{faq.question}</p>
                        )}

                        <div className="flex items-start justify-between w-full mt-auto">
                          <Chip 
                            label={getStatusText(faq.question_status)} 
                            className={`${getStatusColor(faq.question_status)} text-xs text-white`} 
                            size="small" 
                            style={{ color: '#fff' }}
                          />
                          {faq.question_status !== 'question_approved' && (
                            <button
                              onClick={() => handleApproveQuestion(faq.id)}
                              disabled={approvingQuestions[faq.id]}
                              className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50"
                              style={{ color: '#fff' }}
                            >
                              {approvingQuestions[faq.id] ? 'Approving...' : 'Approve'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Answer Card */}
                      <div className={`bg-gray-800/50 border border-gray-600/50 rounded-lg p-4 text-left h-full ${faq.ai_response_answers ? 'h-[480px]' : 'h-[160px]'}`}>
                        <div className="flex items-start justify-between w-full mb-3">
                          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Answer</h4>
                          {faq.ai_response_answers && (
                            <button
                              onClick={() => setEditingAnswer(prev => ({ ...prev, [faq.id]: faq.ai_response_answers }))}
                              className="text-gray-400 hover:text-white transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                          )}
                        </div>
                        
                        {editingAnswer[faq.id] !== undefined ? (
                          <div className="flex-1 flex flex-col w-full">
                            <textarea
                              value={editingAnswer[faq.id]}
                              onChange={(e) => setEditingAnswer(prev => ({ ...prev, [faq.id]: e.target.value }))}
                              className={`w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 text-sm ${faq.ai_response_answers ? 'h-[340px]' : 'h-[100px]'}`}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveEdit(faq.id, 'answer', editingAnswer[faq.id])}
                                className="bg-green-600 text-white px-3 py-1 rounded text-xs"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingAnswer(prev => { const newState = { ...prev }; delete newState[faq.id]; return newState; })}
                                className="bg-gray-600 text-white px-3 py-1 rounded text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {faq.ai_response_answers ? (
                              <p className="text-white text-sm">{faq.ai_response_answers}</p>
                            ) : (
                              <p className="text-gray-500 text-sm italic">No answer generated yet</p>
                            )}
                            
                            <div className="flex items-start justify-between w-full mt-auto">
                              <Chip 
                                label={getStatusText(faq.answer_status)} 
                                className={`${getStatusColor(faq.answer_status)} text-xs text-white`} 
                                size="small" 
                                style={{ color: '#fff' }}
                              />
                              {faq.ai_response_answers && faq.answer_status !== 'approved' && (
                                <button
                                  onClick={() => handleApproveAnswer(faq.id)}
                                  disabled={approvingAnswers[faq.id]}
                                  className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50"
                                  style={{ color: '#fff' }}
                                >
                                  {approvingAnswers[faq.id] ? 'Approving...' : 'Approve'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {groupedFaqPairs.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No FAQ Pairs Yet</h3>
          <p className="text-gray-400 mb-4">Generate your first set of questions to get started</p>
          <p className="text-sm text-gray-500">
            Use the generation panel above to create FAQs or conversational questions from your pending batches.
          </p>
        </div>
      )}

      {/* AI Refine Modal */}
      {aiRefineModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg">
            <h2 className="text-2xl font-bold mb-4">AI Refine Prompt</h2>
            {aiRefineStep === 'prompt' ? (
              <>
                                 <div className="space-y-2 mb-4">
                   <label htmlFor="topic" className="text-sm font-semibold text-gray-400">Topic</label>
                   <input
                     type="text"
                     id="topic"
                     value={faqPairs.find(f => f.id === aiRefineTargetId)?.topic || ''}
                     className="w-full bg-gray-200 text-black border border-gray-300 rounded px-3 py-2 text-sm"
                     readOnly
                   />
                 </div>
                 <div className="space-y-2 mb-4">
                   <label htmlFor="question" className="text-sm font-semibold text-gray-400">Question</label>
                   <input
                     type="text"
                     id="question"
                     value={faqPairs.find(f => f.id === aiRefineTargetId)?.question || ''}
                     className="w-full bg-gray-200 text-black border border-gray-300 rounded px-3 py-2 text-sm"
                     readOnly
                   />
                 </div>
                                 <div className="space-y-2 mb-4">
                   <label htmlFor="instructions" className="text-sm font-semibold text-gray-400">Instructions</label>
                   <p className="text-sm text-gray-600 mb-2">
                     Describe how you'd like the AI to improve this question. For example: "Make it more concise", "Make it more engaging", "Focus on business benefits", etc.
                   </p>
                 </div>
                 <div className="space-y-2 mb-4">
                   <label htmlFor="prompt" className="text-sm font-semibold text-gray-400">Your Feedback</label>
                   <textarea
                     id="prompt"
                     value={aiRefinePrompt}
                     onChange={(e) => setAiRefinePrompt(e.target.value)}
                     className="w-full bg-gray-200 text-black border border-gray-300 rounded px-3 py-2 text-sm h-24"
                     placeholder="Describe how you'd like the AI to improve this question..."
                   />
                 </div>
                <div className="mt-4 flex gap-2">
                                     <button
                     onClick={async () => {
                       setAiRefineLoading(true);
                       try {
                         const { data: { session } } = await supabase.auth.getSession();
                         if (!session) throw new Error("No active session");

                         const currentFaq = faqPairs.find(f => f.id === aiRefineTargetId);
                         if (!currentFaq) throw new Error("FAQ not found");

                         const response = await fetch("https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/refinement_agent", {
                           method: "POST",
                           headers: {
                             "Content-Type": "application/json",
                             "Authorization": `Bearer ${session.access_token}`,
                             "x-client-info": "supabase-js/2.39.3",
                             "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                           },
                           body: JSON.stringify({
                             topic: currentFaq.topic,
                             question: currentFaq.question,
                             userFeedback: aiRefinePrompt
                           }),
                         });

                         if (!response.ok) {
                           const errorData = await response.json();
                           throw new Error(`API Error: ${errorData.error || response.statusText}`);
                         }

                         const result = await response.json();
                         setAiRefineImprovedQuestion(result.improvedQuestion || result.question || 'No improved question returned');
                         setAiRefineStep('result');
                                               } catch (error) {
                          console.error('Error calling refinement agent:', error);
                          setError(`Failed to refine question: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        } finally {
                         setAiRefineLoading(false);
                       }
                     }}
                     className="bg-blue-500 text-white px-3 py-2 rounded text-sm"
                     disabled={aiRefineLoading || !aiRefinePrompt.trim()}
                   >
                     {aiRefineLoading ? 'Refining...' : 'Request AI Refinement'}
                   </button>
                  <button
                    onClick={() => setAiRefineModalOpen(false)}
                    className="bg-gray-500 text-white px-3 py-2 rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  <label htmlFor="improvedQuestion" className="text-sm font-semibold text-gray-400">Improved Question</label>
                  <textarea
                    id="improvedQuestion"
                    value={aiRefineImprovedQuestion}
                    onChange={(e) => setAiRefineImprovedQuestion(e.target.value)}
                    className="w-full bg-gray-200 text-black border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="Enter the improved question"
                  />
                </div>
                <div className="mt-4 flex gap-2">
                                     <button
                     onClick={() => {
                       if (aiRefineTargetId !== null) {
                         setEditingQuestion(prev => ({ ...prev, [aiRefineTargetId]: aiRefineImprovedQuestion }));
                       }
                       setAiRefineModalOpen(false);
                       setAiRefineStep('prompt');
                       setAiRefinePrompt('');
                       setAiRefineImprovedQuestion('');
                     }}
                     className="bg-green-500 text-white px-3 py-2 rounded text-sm"
                   >
                     Accept
                   </button>
                                     <button
                     onClick={() => {
                       setAiRefineStep('prompt');
                       setAiRefinePrompt('');
                       setAiRefineImprovedQuestion('');
                     }}
                     className="bg-orange-500 text-white px-3 py-2 rounded text-sm"
                   >
                     Request Another
                   </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 