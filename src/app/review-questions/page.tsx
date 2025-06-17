'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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

interface ReviewQuestion {
  id: string;
  construct_faq_pair_id: string;
  ai_response_questions: string;
  status: 'pending' | 'approved' | 'edited';
  edited_question: string | null;
}

export default function ReviewQuestions() {
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<Record<string, boolean>>({});
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('construct_faq_pairs')
        .select('id, ai_response_questions')
        .not('ai_response_questions', 'is', null);

      if (error) throw error;

      // Parse all questions into a flat array
      const allRows: any[] = [];
      (data || []).forEach((pair: any) => {
        try {
          const parsed = JSON.parse(pair.ai_response_questions);
          if (parsed.topics) {
            parsed.topics.forEach((topicObj: any) => {
              topicObj.questions.forEach((qObj: any) => {
                allRows.push({
                  pairId: pair.id,
                  topic: topicObj.topic,
                  question: qObj.question,
                });
              });
            });
          }
        } catch (e) {
          // fallback: treat as plain text
          allRows.push({
            pairId: pair.id,
            topic: '',
            question: pair.ai_response_questions,
          });
        }
      });
      setParsedQuestions(allRows);
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
        q.id === id ? { ...q, ai_response_questions: newQuestion } : q
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
      <Typography variant="h4" gutterBottom>
        Review Questions
      </Typography>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Topic</TableCell>
            <TableCell>Question</TableCell>
            <TableCell>Edit</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {parsedQuestions.map((row, idx) => (
            <TableRow key={idx}>
              <TableCell>{row.topic}</TableCell>
              <TableCell>
                <TextField
                  fullWidth
                  value={row.question}
                  onChange={e => {
                    const updated = [...parsedQuestions];
                    updated[idx].question = e.target.value;
                    setParsedQuestions(updated);
                  }}
                />
              </TableCell>
              <TableCell>
                {/* Add approve/edit buttons as needed */}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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