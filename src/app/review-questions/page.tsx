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
  id: string;
  construct_faq_pair_id: string;
  question_text: string;
  status: 'pending' | 'approved' | 'edited';
  edited_question: string | null;
}

function cleanJsonString(str: string) {
  // Remove all triple backticks and optional 'json' language tag, even if on their own lines
  return str
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
}

export default function ReviewQuestions() {
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

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
      setQuestions(data || []);
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
        .from('review_questions')
        .update({
          edited_question: newQuestion,
          status: 'edited'
        })
        .eq('id', id);

      if (error) throw error;

      setQuestions(questions.map(q => 
        q.id === id ? { ...q, edited_question: newQuestion, status: 'edited' } : q
      ));
    } catch (error) {
      console.error('Error updating question:', error);
      setError('Failed to update question');
    }
  };

  const handleApproveQuestion = async (id: string) => {
    try {
      const { error } = await supabase
        .from('review_questions')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) throw error;

      setQuestions(questions.filter(q => q.id !== id));
    } catch (error) {
      console.error('Error approving question:', error);
      setError('Failed to approve question');
    }
  };

  const handleApproveSelected = async () => {
    setSaving(true);
    try {
      const selectedIds = Object.entries(selectedQuestions)
        .filter(([_, selected]) => selected)
        .map(([id]) => id);

      const { error } = await supabase
        .from('review_questions')
        .update({ status: 'approved' })
        .in('id', selectedIds);

      if (error) throw error;

      // Remove approved questions from the list
      setQuestions(questions.filter(q => !selectedIds.includes(q.id)));
      setSelectedQuestions({});
    } catch (error) {
      console.error('Error approving questions:', error);
      setError('Failed to approve questions');
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

  if (questions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto mt-8">
        <div className="text-center text-lg text-foreground">No questions pending review</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-foreground">Review Questions</h1>
        <button
          onClick={handleApproveSelected}
          disabled={saving || Object.values(selectedQuestions).every(v => !v)}
          className={`px-4 py-2 rounded-lg font-bold transition ${
            saving || Object.values(selectedQuestions).every(v => !v)
              ? 'bg-gray-600 text-white cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {saving ? 'Saving...' : 'Approve Selected'}
        </button>
      </div>

      <div className="space-y-4">
        {questions.map((question) => (
          <div key={question.id} className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-start space-x-4">
              <input
                type="checkbox"
                checked={selectedQuestions[question.id] || false}
                onChange={(e) => setSelectedQuestions(prev => ({
                  ...prev,
                  [question.id]: e.target.checked
                }))}
                className="mt-1"
              />
              <div className="flex-grow">
                <textarea
                  value={question.edited_question || question.question_text}
                  onChange={(e) => handleQuestionEdit(question.id, e.target.value)}
                  className="w-full bg-gray-700 text-white rounded p-2 mb-2"
                  rows={2}
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => handleApproveQuestion(question.id)}
                    className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 