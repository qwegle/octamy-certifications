interface CertificationQueryFilters {
  category?: string;
  level?: string;
  search?: string;
}

export const queryKeys = {
  auth: {
    googleStatus: ['auth', 'google-status'] as const,
  },
  certifications: {
    all: ['certifications'] as const,
    catalog: (filters: CertificationQueryFilters) => ['certifications', 'catalog', filters] as const,
    detail: (slug: string | undefined) => ['certifications', 'detail', slug] as const,
    access: (courseId: number | undefined) => ['certifications', 'access', courseId] as const,
    result: (tempExamId: string | undefined) => ['certifications', 'result', tempExamId] as const,
    certificates: ['certifications', 'certificates'] as const,
    certificate: (certificateId: string | undefined) => ['certifications', 'certificate', certificateId] as const,
    activation: (certificateId: string | undefined) => ['certifications', 'activation', certificateId] as const,
    verification: (certificateId: string | undefined) => ['certifications', 'verification', certificateId] as const,
  },
  practice: {
    all: ['practice'] as const,
    catalog: ['practice', 'catalog'] as const,
    detail: (courseId: number) => ['practice', 'detail', courseId] as const,
    subscription: ['practice', 'subscription'] as const,
    result: (tempExamId: string | undefined) => ['practice', 'result', tempExamId] as const,
  },
  interview: {
    all: ['interview-studio'] as const,
    status: ['interview-studio', 'status'] as const,
    templates: ['interview-studio', 'templates'] as const,
    sessions: ['interview-studio', 'sessions'] as const,
    session: (sessionId: string | undefined) => ['interview-studio', 'session', sessionId] as const,
  },
  profile: {
    all: ['learner-profile'] as const,
    detail: ['learner-profile', 'detail'] as const,
    evidence: ['learner-profile', 'evidence-summary'] as const,
    passportLink: ['learner-profile', 'evidence-passport-link'] as const,
    evidenceGrantRecruiters: ['learner-profile', 'evidence-grants', 'eligible-recruiters'] as const,
    evidenceGrantOptions: ['learner-profile', 'evidence-grants', 'options'] as const,
    evidenceGrants: ['learner-profile', 'evidence-grants', 'list'] as const,
    evidenceAccessHistory: ['learner-profile', 'evidence-grants', 'access-history'] as const,
  },
} as const;
