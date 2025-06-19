import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiService } from '../../services/api';
import { API_ENDPOINTS } from '../../constants/api';
import { Question, ExamAttempt, Course } from '../../types';

interface ExamState {
  currentCourse: Course | null;
  questions: Question[];
  currentQuestionIndex: number;
  answers: number[];
  timeRemaining: number;
  isSubmitting: boolean;
  examResult: ExamAttempt | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ExamState = {
  currentCourse: null,
  questions: [],
  currentQuestionIndex: 0,
  answers: [],
  timeRemaining: 0,
  isSubmitting: false,
  examResult: null,
  isLoading: false,
  error: null,
};

export const fetchExamQuestions = createAsyncThunk(
  'exam/fetchQuestions',
  async (courseId: number) => {
    try {
      const response = await apiService.get<{ questions: Question[] }>(API_ENDPOINTS.EXAM_QUESTIONS(courseId));
      return response.questions || response; // Handle both response formats
    } catch (error) {
      throw new Error('Failed to fetch exam questions');
    }
  }
);

export const submitExam = createAsyncThunk(
  'exam/submit',
  async (examData: {
    courseId: number;
    answers: number[];
    userName?: string;
    userEmail?: string;
  }) => {
    return await apiService.post<{
      examAttempt: ExamAttempt;
      certificate?: any;
      passed: boolean;
      message: string;
    }>(API_ENDPOINTS.EXAM_SUBMIT, examData);
  }
);

const examSlice = createSlice({
  name: 'exam',
  initialState,
  reducers: {
    startExam: (state, action: PayloadAction<{ course: Course; duration: number }>) => {
      state.currentCourse = action.payload.course;
      state.timeRemaining = action.payload.duration * 60; // Convert to seconds
      state.currentQuestionIndex = 0;
      state.answers = [];
      state.examResult = null;
      state.error = null;
    },
    
    setAnswer: (state, action: PayloadAction<{ questionIndex: number; answer: number }>) => {
      const { questionIndex, answer } = action.payload;
      state.answers[questionIndex] = answer;
    },
    
    nextQuestion: (state) => {
      if (state.currentQuestionIndex < state.questions.length - 1) {
        state.currentQuestionIndex += 1;
      }
    },
    
    previousQuestion: (state) => {
      if (state.currentQuestionIndex > 0) {
        state.currentQuestionIndex -= 1;
      }
    },
    
    goToQuestion: (state, action: PayloadAction<number>) => {
      const questionIndex = action.payload;
      if (questionIndex >= 0 && questionIndex < state.questions.length) {
        state.currentQuestionIndex = questionIndex;
      }
    },
    
    decrementTimer: (state) => {
      if (state.timeRemaining > 0) {
        state.timeRemaining -= 1;
      }
    },
    
    clearExam: (state) => {
      state.currentCourse = null;
      state.questions = [];
      state.currentQuestionIndex = 0;
      state.answers = [];
      state.timeRemaining = 0;
      state.examResult = null;
      state.error = null;
    },
    
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch questions
      .addCase(fetchExamQuestions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchExamQuestions.fulfilled, (state, action) => {
        state.isLoading = false;
        const questions = Array.isArray(action.payload) ? action.payload : action.payload.questions || [];
        state.questions = questions;
        state.answers = new Array(questions.length).fill(-1);
        state.timeRemaining = questions.length > 0 ? 60 * 60 : 0; // 60 minutes default
      })
      .addCase(fetchExamQuestions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch exam questions';
      })
      
      // Submit exam
      .addCase(submitExam.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(submitExam.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.examResult = action.payload.examAttempt;
      })
      .addCase(submitExam.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.error.message || 'Failed to submit exam';
      });
  },
});

export const {
  startExam,
  setAnswer,
  nextQuestion,
  previousQuestion,
  goToQuestion,
  decrementTimer,
  clearExam,
  clearError,
} = examSlice.actions;

export default examSlice.reducer;