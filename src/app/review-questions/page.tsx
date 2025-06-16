'use client';
import { useState, useEffect } from 'react';
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
  Container,
  Alert
} from '@mui/material';

interface ReviewQuestion {
  id: string;
  construct_faq_pair_id: string;
  question_text: string;
  status: 'pending' | 'approved' | 'edited';
  edited_question: string | null;
}

export default function ReviewQuestions() {
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<Record<string, boolean>>({});
  const supabase = useSupabaseClient();

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('construct_faq_pairs')
        .select('*')
        .eq('generation_status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;

      setQuestions(data || []);
      // Initialize selected state for each question
      const initialSelected: Record<string, boolean> = {};
      data?.forEach((question: ReviewQuestion) => {
        initialSelected[question.id] = true; // Default all to selected
      });
      setSelectedQuestions(initialSelected);
    } catch (error) {
      console.error('Error fetching questions:', error);
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionEdit = async (id: string, newQuestion: string) => {
    try {
      const { error } = await supabase
        .from('construct_faq_pairs')
        .update({
          ai_response_questions: newQuestion,
          generation_status: 'completed'
        })
        .eq('id', id);

      if (error) throw error;

      setQuestions(questions.map(q => 
        q.id === id ? { ...q, question_text: newQuestion } : q
      ));
    } catch (error) {
      console.error('Error updating question:', error);
      setError('Failed to update question');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelected: Record<string, boolean> = {};
    questions.forEach(question => {
      newSelected[question.id] = checked;
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

      // Update selected questions to completed
      const { error: updateError } = await supabase
        .from('construct_faq_pairs')
        .update({ generation_status: 'completed' })
        .in('id', selectedIds);

      if (updateError) throw updateError;

      // Refresh the questions list
      fetchQuestions();
    } catch (error) {
      console.error('Error approving questions:', error);
      setError('Failed to approve questions');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (questions.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography variant="h5" align="center">
          No questions pending review
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Review Questions
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={Object.values(selectedQuestions).every(v => v)}
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
          }
          label="Select All"
        />
      </Stack>
      
      {questions.map((question) => (
        <Card key={question.id} sx={{ mb: 2, p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Checkbox
              checked={selectedQuestions[question.id] || false}
              onChange={(e) => handleSelectQuestion(question.id, e.target.checked)}
            />
            <TextField
              fullWidth
              multiline
              rows={2}
              value={question.edited_question || question.question_text}
              onChange={(e) => handleQuestionEdit(question.id, e.target.value)}
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