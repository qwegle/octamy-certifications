export const CREDIT_COSTS = {
  PROFILE_VIEW: 1,
  CV_DOWNLOAD: 1,
  INTERVIEW_ACCESS: 2
} as const;

export const KYC_STATUS = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected'
} as const;

export const REGISTRATION_STEPS = {
  PERSONAL_INFO: 1,
  COMPANY_INFO: 2,
  KYC_DOCUMENTS: 3,
  COMPLETED: 4
} as const;

export const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '500+', label: '500+ employees' },
];

export const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing',
  'Retail', 'Consulting', 'Media', 'Real Estate', 'Transportation',
  'Energy', 'Government', 'Non-profit', 'Other'
];

export const TECHNOLOGIES = [
  'JavaScript', 'Python', 'React', 'Node.js', 'Java', 'C++', 'Angular',
  'Vue.js', 'TypeScript', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin'
];

export const WORK_TYPES = ['Remote', 'On-site', 'Hybrid'];
export const NOTICE_PERIODS = ['Immediate', '15 days', '30 days', '60 days', '90 days'];
export const CATEGORIES = ['AI', 'Development', 'Business', 'Data Science', 'DevOps'];