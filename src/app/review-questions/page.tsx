'use client';
import React, { useState, useEffect } from 'react';
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
  id: number;
  topic: string;
  question: string;
  question_status: string;
}

export default function ReviewQuestions() {
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('review_questions')
        .select('id, topic, question, question_status')
        .eq('question_status', 'questions_generated')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setQuestions(data || []);
    } catch (error) {
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelected: Record<number, boolean> = {};
    questions.forEach(question => {
      newSelected[question.id] = checked;
    });
    setSelectedQuestions(newSelected);
  };

  const handleSelectQuestion = (id: number, checked: boolean) => {
    setSelectedQuestions(prev => ({
      ...prev,
      [id]: checked
    }));
  };

  const handleApproveSelected = async () => {
    try {
      const selectedIds = Object.entries(selectedQuestions)
        .filter(([_, selected]) => selected)
        .map(([id]) => parseInt(id));

      // Update selected questions to approved
      const { error: updateError } = await supabase
        .from('review_questions')
        .update({ question_status: 'approved' })
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

  if (questions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto mt-8">
        <div className="text-center text-lg text-foreground">No questions pending review</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Review Questions</h1>
      <div className="mb-4">
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleApproveSelected}
          disabled={Object.values(selectedQuestions).every(v => !v)}
        >
          Approve Selected
        </Button>
      </div>
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr>
            <th className="text-foreground font-semibold py-2 px-4">
              <Checkbox
                onChange={(e) => handleSelectAll(e.target.checked)}
                checked={questions.length > 0 && questions.every(q => selectedQuestions[q.id])}
              />
            </th>
            <th className="text-foreground font-semibold py-2 px-4">Topic</th>
            <th className="text-foreground font-semibold py-2 px-4">Question</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((question) => (
            <tr key={question.id} className="bg-transparent border-b border-gray-700">
              <td className="text-foreground py-1 px-4">
                <Checkbox
                  checked={!!selectedQuestions[question.id]}
                  onChange={(e) => handleSelectQuestion(question.id, e.target.checked)}
                />
              </td>
              <td className="text-foreground py-1 px-4 align-top w-1/4">{question.topic}</td>
              <td className="text-foreground py-1 px-4 align-top w-3/5">{question.question}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 