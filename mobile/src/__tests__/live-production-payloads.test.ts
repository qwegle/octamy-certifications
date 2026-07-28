import { getCertification, getCertifications, getCourseAccess } from '@/features/certifications/api';
import { getInterviewStatus } from '@/features/interview/interview.api';
import { getPracticeCatalog, getPracticeDetail } from '@/features/practice/practice.api';

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' }, status: 200 });
}

const category = { id: 52, kind: 'skill', name: 'Software Engineering', slug: 'software-engineering' };
const certification = {
  assessmentPurpose: 'certification', audienceBands: [], canonicalPath: '/get-certified/api-design-microservices-foundations',
  category, certificationLabel: 'Octamy-certified', certificationMode: 'octamy', createdAt: '2026-07-15T20:03:41.944Z',
  creator: null, description: 'HTTP contracts, boundaries, reliability, security, observability and distributed-system trade-offs.',
  duration: 70, featuredAt: null, id: 202, isOnSale: false, language: 'en', level: 'advanced', origin: 'octamy',
  originLabel: 'Octamy in-house', originalPrice: null, passingScore: 72, price: '199.00', slug: 'api-design-microservices-foundations',
  subscriptionEligible: false, thumbnailUrl: null, title: 'API Design and Microservices Skills',
};
const practice = {
  ...certification, assessmentPurpose: 'practice', audienceBands: [{ id: 6, code: 'competitive_exam', label: 'Competitive exam aspirants' }],
  canonicalPath: '/practice/ibps-po-english-language-practice', category: { id: 18, kind: 'exam_family', name: 'SSC', slug: 'ssc' },
  certificationLabel: 'Practice only', certificationMode: 'none', id: 279, origin: 'practice', originLabel: 'Octamy practice',
  price: '0.00', slug: 'ibps-po-english-language-practice', subscriptionEligible: true, title: 'IBPS PO English Language Practice',
};
const pagination = { page: 1, pageSize: 48, total: 1, totalPages: 1 };
const facets = { audienceBands: [], categories: [category], levels: ['advanced'] };

describe('live production payload compatibility (captured 2026-07-28)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('accepts live certification catalog, detail, and access shapes', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/assessments?')) return jsonResponse({ facets, items: [certification], pagination });
      if (url.endsWith('/api/assessments/api-design-microservices-foundations')) return jsonResponse({ ...certification, categoryId: 52, metaDescription: certification.description, metaTitle: 'API Design', ownerType: 'admin', productType: 'assessment' });
      if (url.endsWith('/api/courses/202/access')) return jsonResponse({ contentPrice: null, courseId: 202, entitlement: null, hasAccess: true, lessonCount: 0, previewCount: 0, productType: 'assessment', requiresPurchase: false });
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    await expect(getCertifications({})).resolves.toMatchObject({ items: [{ id: 202, price: '199.00' }] });
    await expect(getCertification(certification.slug)).resolves.toMatchObject({ id: 202, categoryId: 52 });
    await expect(getCourseAccess(202)).resolves.toEqual(expect.objectContaining({ courseId: 202, hasAccess: true }));
  });

  it('accepts live Practice audience bands without a description field', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/practice-assessments?')) return jsonResponse({ facets: { audienceBands: practice.audienceBands, categories: [practice.category], levels: ['advanced'] }, items: [practice], pagination });
      if (url.endsWith('/api/practice-assessments/279')) return jsonResponse({ ...practice, categoryId: 18, metaDescription: 'Practice description', metaTitle: practice.title, ownerType: 'admin', productType: 'assessment' });
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    await expect(getPracticeCatalog()).resolves.toMatchObject({ items: [{ audienceBands: [{ code: 'competitive_exam' }], id: 279 }] });
    await expect(getPracticeDetail('279')).resolves.toMatchObject({ id: 279, assessmentPurpose: 'practice' });
  });

  it('accepts the live Interview Studio readiness shape', async () => {
    global.fetch = jest.fn(async () => jsonResponse({
      aiEvaluationEnabled: false, codeRunnerEnabled: false, consentVersion: 'interview-practice-2026-07-16',
      evaluationWorkerEnabled: true, limitations: ['practice_sessions_are_private', 'camera_and_screen_are_readiness_checks_only'],
      practiceEnabled: true, recordingEnabled: false, verifiedEnabled: false, voiceTranscriptionEnabled: false,
    })) as typeof fetch;

    await expect(getInterviewStatus()).resolves.toEqual(expect.objectContaining({ practiceEnabled: true, recordingEnabled: false, verifiedEnabled: false }));
  });
});
