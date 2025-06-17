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
  ai_response_questions: string;
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
                  });
                  added = true;
                });
              }
            });
          }
        } catch (e) {
          // Ignore parse error
        }
        // If nothing was added, show the raw string
        if (!added) {
          allRows.push({
            pairId: pair.id,
            topic: '',
            question: raw,
          });
        }
      });
      console.log('Rows to display:', allRows);
      setParsedQuestions(allRows);
    } catch (error) {
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

  if (parsedQuestions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto mt-8">
        <div className="text-center text-lg text-foreground">No questions pending review</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Review Questions</h1>
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr>
            <th className="text-foreground font-semibold py-2 px-4">Topic</th>
            <th className="text-foreground font-semibold py-2 px-4">Question</th>
            <th className="text-foreground font-semibold py-2 px-4">Edit</th>
          </tr>
        </thead>
        <tbody>
          {parsedQuestions.map((row, idx) => (
            <tr key={idx} className="bg-transparent border-b border-gray-700">
              <td className="text-foreground py-1 px-4 align-top w-1/4">{row.topic}</td>
              <td className="text-foreground py-1 px-4 align-top w-3/5">
                <input
                  className="w-full bg-background text-foreground border border-gray-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand"
                  value={row.question}
                  onChange={e => {
                    const updated = [...parsedQuestions];
                    updated[idx].question = e.target.value;
                    setParsedQuestions(updated);
                  }}
                />
              </td>
              <td className="text-foreground py-1 px-4 align-top w-1/6">{/* Edit/Approve buttons */}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <style jsx>{`
        .text-foreground { color: var(--foreground); }
        .bg-background { background: var(--background); }
        .focus\:ring-brand:focus { box-shadow: 0 0 0 2px var(--brand); }
      `}</style>
    </div>
  );
} 