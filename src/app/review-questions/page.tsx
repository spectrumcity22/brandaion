'use client';
import { useState, useEffect, ChangeEvent } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
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
  Container
} from '@mui/material';

interface FAQPair {
  id: string;
  unique_batch_id: string;
  ai_response_questions: string;
  generation_status: string;
  questions_status?: string;
  timestamp: string;
}

// Define a type for the question object
type Question = {
  id: string;
  text: string;
  status: 'pending' | 'approved' | 'edited';
};

export default function ReviewQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBatch, setCurrentBatch] = useState<FAQPair[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Record<string, boolean>>({});
  const supabase = useSupabaseClient();

  useEffect(() => {
    async function fetchQuestions() {
      try {
        const response = await fetch('/api/questions');
        if (!response.ok) {
          throw new Error('Failed to fetch questions');
        }
        const data = await response.json();
        setQuestions(data);
      } catch (error) {
        console.error('Error fetching questions:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchQuestions();
  }, []);

  useEffect(() => {
    fetchCurrentBatch();
  }, []);

  const fetchCurrentBatch = async () => {
    try {
      // Get the first batch that needs approval
      const { data: firstBatch } = await supabase
        .from('construct_faq_pairs')
        .select('*')
        .not('ai_response_questions', 'is', null)
        .eq('generation_status', 'completed')
        .is('ai_response_answers', null)
        .order('timestamp', { ascending: true })
        .limit(1);

      if (firstBatch?.[0]) {
        // Get all FAQ pairs in this batch
        const { data: batchPairs } = await supabase
          .from('construct_faq_pairs')
          .select('*')
          .eq('unique_batch_id', firstBatch[0].unique_batch_id)
          .order('timestamp', { ascending: true });

        setCurrentBatch(batchPairs || []);
        // Initialize selected state for each question
        const initialSelected: Record<string, boolean> = {};
        batchPairs?.forEach((pair: FAQPair) => {
          initialSelected[pair.id] = true; // Default all to selected
        });
        setSelectedQuestions(initialSelected);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching batch:', error);
    }
  };

  const handleQuestionEdit = async (id: string, newQuestion: string) => {
    try {
      await supabase
        .from('construct_faq_pairs')
        .update({
          ai_response_questions: newQuestion
        })
        .eq('id', id);

      setCurrentBatch(currentBatch.map(pair => 
        pair.id === id ? { ...pair, ai_response_questions: newQuestion } : pair
      ));
    } catch (error) {
      console.error('Error updating question:', error);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelected: Record<string, boolean> = {};
    currentBatch.forEach(pair => {
      newSelected[pair.id] = checked;
    });
    setSelectedQuestions(newSelected);
  };

  const handleSelectQuestion = (id: string, checked: boolean) => {
    setSelectedQuestions(prev => ({
      ...prev,
      [id]: checked
    }));
  };

  const handleApproveSelected = async () => {
    try {
      const selectedIds = Object.entries(selectedQuestions)
        .filter(([_, selected]) => selected)
        .map(([id]) => id);

      // Update selected questions
      await supabase
        .from('construct_faq_pairs')
        .update({ 
          questions_status: 'approved',
          generation_status: 'questions_approved'
        })
        .in('id', selectedIds);

      // If all questions in batch are approved, trigger next batch
      if (selectedIds.length === currentBatch.length) {
        await fetch('/api/process-next-batch', { method: 'POST' });
      }

      // Refresh the current batch
      fetchCurrentBatch();
    } catch (error) {
      console.error('Error approving questions:', error);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch(`/api/questions/${id}/approve`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to approve question');
      }
      setQuestions(questions.map(q => q.id === id ? { ...q, status: 'approved' } : q));
    } catch (error) {
      console.error('Error approving question:', error);
    }
  };

  const handleEdit = async (id: string) => {
    // Implement edit functionality, e.g., open a modal or navigate to an edit page
    console.log('Edit question:', id);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (currentBatch.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography variant="h5" align="center">
          No FAQ questions pending approval
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Review FAQ Questions - Batch {currentBatch[0]?.unique_batch_id}
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={Object.values(selectedQuestions).every(v => v)}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleSelectAll(e.target.checked)}
            />
          }
          label="Select All"
        />
      </Stack>
      
      {currentBatch.map((pair) => (
        <Card key={pair.id} sx={{ mb: 2, p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Checkbox
              checked={selectedQuestions[pair.id] || false}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleSelectQuestion(pair.id, e.target.checked)}
            />
            <TextField
              fullWidth
              multiline
              rows={2}
              value={pair.ai_response_questions}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleQuestionEdit(pair.id, e.target.value)}
              label="Question"
              variant="outlined"
            />
          </Stack>
        </Card>
      ))}

      <Button
        variant="contained"
        color="primary"
        onClick={handleApproveSelected}
        disabled={Object.values(selectedQuestions).every(v => !v)}
        sx={{ mt: 2 }}
      >
        Approve Selected Questions
      </Button>
    </Container>
  );
} 