// API Configuration
export const API_CONFIG = {
  // Update this to your web app's URL when deploying
  BASE_URL: 'http://localhost:5000', // Will be configured for production
  TIMEOUT: 10000,
};

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  USER: '/api/user',

  // Courses
  COURSES: '/api/courses',
  CATEGORIES: '/api/categories',
  COURSE_DETAIL: (id: number) => `/api/courses/${id}`,

  // Exams
  EXAM_QUESTIONS: (courseId: number) => `/api/courses/${courseId}/questions`,
  EXAM_SUBMIT: '/api/exam/submit',
  EXAM_RESULT: (id: number) => `/api/exam-results/${id}`,

  // Certificates
  USER_CERTIFICATES: '/api/user/certificates',
  CERTIFICATE_DETAIL: (id: string) => `/api/certificates/${id}`,
  CERTIFICATE_DOWNLOAD: (id: string) => `/api/certificates/${id}/download`,
  RECENT_CERTIFICATES: '/api/recent-certificates',

  // Payments
  PAYMENT_INITIATE: '/api/payment/initiate',
  PAYMENT_STATUS: (transactionId: string) => `/api/payment/status/${transactionId}`,
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
  OFFLINE_EXAMS: 'offline_exams',
  CACHED_COURSES: 'cached_courses',
  CACHED_CERTIFICATES: 'cached_certificates',
  PUSH_TOKEN: 'push_token',
} as const;

// App Configuration
export const APP_CONFIG = {
  NAME: 'Octamy',
  VERSION: '1.0.0',
  PRIMARY_COLOR: '#000000',
  SECONDARY_COLOR: '#ffffff',
  ACCENT_COLOR: '#3b82f6',
} as const;