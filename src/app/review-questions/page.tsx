'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Button,
  Typography,
  Box,
  CircularProgress,
  Container,
  Alert,
  Card,
  CardContent,
  Stack,
} from '@mui/material';

interface ParsedQuestion {
  pairId: string;
  topic: string;
  question: string;
  batchId: string;
  original: any;
}

function cleanJsonString(str: string) {
  return str
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
}

export default function ReviewQuestions() {
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editedQuestions, setEditedQuestions] = useState<Record<string, string>>({});
  const [approving, setApproving] = useState<string | null>(null);
  const [batchApproving, setBatchApproving] = useState<string | null>(null);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('construct_faq_pairs')
        .select('id, ai_response_questions, unique_batch_id')
        .not('ai_response_questions', 'is', null);
      if (error) throw error;
      const allRows: ParsedQuestion[] = [];
      (data || []).forEach((pair: any) => {
        let raw = pair.ai_response_questions;
        let cleaned = cleanJsonString(raw);
        let parsed = null;
        let added = false;
        try {
          parsed = JSON.parse(cleaned);
          if (parsed && Array.isArray(parsed.topics)) {
            parsed.topics.forEach((topicObj: any) => {
              if (Array.isArray(topicObj.questions)) {
                topicObj.questions.forEach((qObj: any) => {
                  allRows.push({
                    pairId: pair.id,
                    topic: topicObj.topic || '',
                    question: qObj.question || '',
                    batchId: pair.unique_batch_id || 'default',
                    original: qObj,
                  });
                  added = true;
                });
              }
            });
          }
        } catch (e) {}
        if (!added) {
          allRows.push({
            pairId: pair.id,
            topic: '',
            question: raw,
            batchId: pair.unique_batch_id || 'default',
            original: raw,
          });
        }
      });
      setParsedQuestions(allRows);
    } catch (error) {
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  // Group questions by batchId
  const batches = parsedQuestions.reduce((acc, q) => {
    if (!acc[q.batchId]) acc[q.batchId] = [];
    acc[q.batchId].push(q);
    return acc;
  }, {} as Record<string, ParsedQuestion[]>);

  const handleEdit = (pairId: string, idx: number, value: string) => {
    setParsedQuestions(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], question: value };
      return updated;
    });
    setEditedQuestions(prev => ({ ...prev, [pairId]: value }));
  };

  const handleSave = async (pairId: string, question: string) => {
    try {
      setApproving(pairId);
      const { error } = await supabase
        .from('construct_faq_pairs')
        .update({ ai_response_questions: question })
        .eq('id', pairId);
      if (error) throw error;
      setEditedQuestions(prev => {
        const copy = { ...prev };
        delete copy[pairId];
        return copy;
      });
      fetchQuestions();
    } catch (e) {
      setError('Failed to save question');
    } finally {
      setApproving(null);
    }
  };

  const handleApprove = async (pairId: string) => {
    try {
      setApproving(pairId);
      const { error } = await supabase
        .from('construct_faq_pairs')
        .update({ generation_status: 'completed' })
        .eq('id', pairId);
      if (error) throw error;
      fetchQuestions();
    } catch (e) {
      setError('Failed to approve question');
    } finally {
      setApproving(null);
    }
  };

  const handleBatchApprove = async (batchId: string) => {
    try {
      setBatchApproving(batchId);
      const batchPairIds = (batches[batchId] || []).map(q => q.pairId);
      // 1. Update status to 'question_approved'
      const { error } = await supabase
        .from('construct_faq_pairs')
        .update({ generation_status: 'question_approved' })
        .in('id', batchPairIds);
      if (error) throw error;
      // 2. Trigger the answers webhook
      if (!batchId) {
        console.error('No batchId provided for answers webhook');
        setError('No batchId provided for answers webhook');
        return;
      }
      // Get the user's access token
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setError('No access token found. Please log in again.');
        return;
      }
      console.log('Triggering answers webhook with batchId:', batchId);
      const webhookResponse = await fetch('https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/ai_request_answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ batchId }),
      });
      if (!webhookResponse.ok) {
        const respText = await webhookResponse.text();
        console.error('Answers webhook error:', respText);
        setError('Failed to trigger answers webhook: ' + respText);
        return;
      }
      fetchQuestions();
    } catch (e) {
      console.error('Batch approval error:', e);
      setError('Failed to approve batch and trigger answers webhook: ' + (e instanceof Error ? e.message : JSON.stringify(e)));
    } finally {
      setBatchApproving(null);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }
  if (parsedQuestions.length === 0) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography align="center">No questions pending review</Typography>
      </Container>
    );
  }
  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" fontWeight="bold" mb={4}>Review Questions</Typography>
      {Object.entries(batches).map(([batchId, questions]) => (
        <Card key={batchId} sx={{ mb: 4, background: 'var(--background)', color: 'var(--foreground)' }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Batch: {batchId}</Typography>
              <Button
                variant="contained"
                color="success"
                onClick={() => handleBatchApprove(batchId)}
                disabled={batchApproving === batchId}
              >
                {batchApproving === batchId ? 'Approving...' : 'Approve Batch'}
              </Button>
            </Stack>
            <Box component="table" width="100%">
              <Box component="thead">
                <Box component="tr">
                  <Box component="th" sx={{ textAlign: 'left', p: 1 }}>Topic</Box>
                  <Box component="th" sx={{ textAlign: 'left', p: 1 }}>Question</Box>
                  <Box component="th" sx={{ textAlign: 'left', p: 1 }}>Actions</Box>
                </Box>
              </Box>
              <Box component="tbody">
                {questions.map((row, idx) => (
                  <Box component="tr" key={idx}>
                    <Box component="td" sx={{ p: 1, width: '20%' }}>{row.topic}</Box>
                    <Box component="td" sx={{ p: 1, width: '60%' }}>
                      <textarea
                        style={{ width: '100%', minHeight: 48, background: 'var(--background)', color: 'var(--foreground)', border: '1px solid #444', borderRadius: 4, padding: 4 }}
                        value={row.question}
                        onChange={e => handleEdit(row.pairId, parsedQuestions.findIndex(q => q.pairId === row.pairId && q.question === row.question), e.target.value)}
                      />
                    </Box>
                    <Box component="td" sx={{ p: 1, width: '20%' }}>
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleSave(row.pairId, row.question)}
                          disabled={approving === row.pairId}
                        >
                          Save
                        </Button>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          onClick={() => handleApprove(row.pairId)}
                          disabled={approving === row.pairId}
                        >
                          {approving === row.pairId ? 'Approving...' : 'Approve'}
                        </Button>
                      </Stack>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Container>
  );
} 