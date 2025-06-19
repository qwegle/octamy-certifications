// API Response Types
export interface User {
  id: number;
  email: string;
  name: string;
  isAdmin?: boolean;
}

export interface Course {
  id: number;
  title: string;
  description: string;
  duration: number;
  price: number;
  passingScore: number;
  categoryId: number;
  category?: Category;
}

export interface Category {
  id: number;
  name: string;
  description: string;
}

export interface Question {
  id: number;
  questionText: string;
  options: string[];
  correctAnswer: number;
  courseId: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Certificate {
  id: number;
  certificateId: string;
  userId?: number;
  userEmail: string;
  userName: string;
  courseId: number;
  courseTitle: string;
  score: number;
  badge: string;
  issuedAt: string;
  expiresAt?: string;
  isPaid: boolean;
  isActive: boolean;
}

export interface ExamAttempt {
  id: number;
  userId?: number;
  userEmail: string;
  courseId: number;
  score: number;
  totalQuestions: number;
  answers: number[];
  completedAt: string;
  passed: boolean;
}

export interface Payment {
  id: number;
  userId?: number;
  userEmail: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  transactionId: string;
  certificateId?: number;
  createdAt: string;
}

// Navigation Types
export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: undefined;
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Courses: undefined;
  CourseDetail: { courseId: number };
  Exam: { courseId: number };
  ExamResult: { examId: number };
  Certificates: undefined;
  CertificateView: { certificateId: string };
  Profile: undefined;
  Payment: { certificateId: number };
};

export type TabParamList = {
  Home: undefined;
  Courses: undefined;
  Certificates: undefined;
  Profile: undefined;
};

// Auth Types
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

// Exam Types
export interface ExamState {
  currentCourse: Course | null;
  questions: Question[];
  currentQuestionIndex: number;
  answers: number[];
  timeRemaining: number;
  isSubmitting: boolean;
}

// API Configuration
export interface ApiConfig {
  baseURL: string;
  timeout: number;
}