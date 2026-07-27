import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import RecruiterLayout from '../components/RecruiterLayout';
import InterviewEvidenceNotice from '../components/InterviewEvidenceNotice';
import { useRecruiterAuth } from '../auth/RecruiterAuthProvider';
import { downloadCandidateCv } from '../utils/downloadCandidateCv';
import {
  User,
  MapPin,
  Calendar,
  Trophy,
  Award,
  BarChart3,
  Download,
  Eye,
  Code,
  Briefcase
} from 'lucide-react';

interface Certificate {
  id: number;
  certificateId?: string;
  courseTitle: string;
  score: number;
  badge: string;
  issuedAt: string;
  expiresAt?: string;
  issuedBy?: string;
  difficulty?: string;
  category?: string;
}

interface PracticeSummary {
  id: number;
  courseTitle: string;
  score: number;
  totalQuestions: number;
  durationSeconds: number;
  passed: boolean;
  mastered: boolean;
  completedAt: string;
}

interface SelectedEvidence {
  grant: { id: string; purpose: string; jobReference: string | null; grantedAt: string; expiresAt: string };
  certifications: Certificate[];
  practiceSummaries: PracticeSummary[];
  policyVersion: string;
}

interface CandidateProfile {
  id: number;
  name: string;
  email: string;
  location: string;
  experience: number;
  currentRole: string;
  skills: string[];
  certificates: Certificate[];
  profileViews: number;
  profileCompleteness?: number;
  averageScore: number;
  dedicationScore: number;
  careerGoals?: string;
  availability?: string;
  noticePeriod?: string;
  expectedSalary?: string;
  hasResume: boolean;
  cvAccessUnlocked: boolean;
  creditCosts: { profile_view: number; cv_download: number };
}

export default function CandidateProfile() {
  const [, params] = useRoute('/recruiter/profile/:id');
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<SelectedEvidence | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(true);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { updateRecruiter } = useRecruiterAuth();

  const candidateId = params?.id;

  useEffect(() => {
    if (candidateId) {
      fetchCandidateProfile(candidateId);
    }
  }, [candidateId]);

  const fetchCandidateProfile = async (id: string) => {
    setLoading(true);
    setLoadError(null);
    setEvidenceLoading(true);
    setEvidenceError(null);
    try {
      // Try to fetch from dedicated recruiter endpoint first
      let response = await fetch(`/api/recruiter/candidate/${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('recruiterToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `Failed to fetch candidate profile: ${response.status}`);
      }
      
      const profileData = await response.json();
      const {
        interviews: retiredPrototypeInterviews,
        interviewAccessUnlocked: retiredPrototypeAccess,
        ...recruiterVisibleProfile
      } = profileData;
      void retiredPrototypeInterviews;
      void retiredPrototypeAccess;
      let certs: Certificate[] = [];
      let grantedEvidence: SelectedEvidence | null = null;
      try {
        const grantsResponse = await apiRequest('GET', `/api/recruiter/selected-candidates/${encodeURIComponent(id)}/evidence-grants`);
        const grantData = await grantsResponse.json();
        const activeGrant = Array.isArray(grantData.grants) ? grantData.grants[0] : null;
        if (activeGrant?.id) {
          const evidenceResponse = await apiRequest('GET', `/api/recruiter/selected-candidates/${encodeURIComponent(id)}/evidence/${encodeURIComponent(activeGrant.id)}`);
          const rawEvidence = await evidenceResponse.json() as SelectedEvidence;
          grantedEvidence = {
            ...rawEvidence,
            certifications: Array.isArray(rawEvidence.certifications) ? rawEvidence.certifications : [],
            practiceSummaries: Array.isArray(rawEvidence.practiceSummaries) ? rawEvidence.practiceSummaries : [],
          };
          certs = grantedEvidence.certifications;
        }
      } catch (evidenceFailure) {
        setEvidenceError(evidenceFailure instanceof Error ? evidenceFailure.message : 'Selected evidence could not be checked.');
      } finally {
        setEvidenceLoading(false);
      }
      setSelectedEvidence(grantedEvidence);
      setCandidate({
        ...recruiterVisibleProfile,
        location: profileData.location || 'Location not provided',
        currentRole: profileData.currentRole || 'Role not provided',
        experience: Number(profileData.experience || 0),
        skills: Array.isArray(profileData.skills) ? profileData.skills : [],
        certificates: certs,
        averageScore: calculateAverageScore(certs),
        dedicationScore: Number(profileData.profileCompleteness || 0),
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load candidate profile');
      toast({
        title: 'Profile unavailable',
        description: error instanceof Error ? error.message : 'Failed to load candidate profile',
      });
    } finally {
      setLoading(false);
      setEvidenceLoading(false);
    }
  };

  const calculateAverageScore = (certs: any[]) => {
    if (certs.length === 0) return 0;
    const total = certs.reduce((sum, cert) => sum + (cert.score || 0), 0);
    return Math.round(total / certs.length);
  };

  const getBadgeColor = (badge: string) => {
    switch (badge.toLowerCase()) {
      case 'platinum': return 'bg-purple-100 text-purple-800';
      case 'gold': return 'bg-yellow-100 text-yellow-800';
      case 'silver': return 'bg-gray-100 text-gray-800';
      case 'expert': return 'bg-green-100 text-green-800';
      case 'professional': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDownloadCv = async () => {
    if (!candidate) return;
    try {
      const response = await apiRequest('POST', '/api/recruiter/access-profile', { candidateId: candidate.id, accessType: 'cv' });
      const data = await response.json();
      if (!data.cvUrl) throw new Error('Candidate CV is not available');
      updateRecruiter({ creditsBalance: data.remainingCredits });
      await downloadCandidateCv(data.cvUrl, candidate.id);
    } catch (error) {
      toast({ title: 'CV unavailable', description: error instanceof Error ? error.message : 'Could not download this CV' });
    }
  };

  if (loading) {
    return (
      <RecruiterLayout><div className="flex min-h-64 items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div></RecruiterLayout>
    );
  }

  if (!candidate) {
    return (
      <RecruiterLayout><div className="flex min-h-64 items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Candidate profile unavailable</h2>
          <p className="text-gray-600">{loadError || 'This profile is not available to your recruiter workspace.'}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => candidateId && void fetchCandidateProfile(candidateId)}>Try again</Button>
        </div>
      </div></RecruiterLayout>
    );
  }

  return (
    <RecruiterLayout><div>
      {/* Header */}
      <div className="bg-cream-soft border-b border-cream-deep">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-2xl font-semibold bg-blue-600 text-white">
                  {candidate.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{candidate.name}</h1>
                <p className="text-gray-600">{candidate.currentRole}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    {candidate.location}
                  </div>
                  <div className="flex items-center">
                    <Briefcase className="h-4 w-4 mr-1" />
                    {candidate.experience} years exp
                  </div>
                  <div className="flex items-center">
                    <Eye className="h-4 w-4 mr-1" />
                    {candidate.profileViews} views
                  </div>
                </div>
              </div>
            </div>
            <div>
              <Button variant="outline" size="sm" onClick={handleDownloadCv} disabled={!candidate.hasResume}>
                <Download className="h-4 w-4 mr-2" />
                {!candidate.hasResume
                  ? 'CV not shared'
                  : candidate.cvAccessUnlocked
                    ? 'Download CV · unlocked'
                    : `Unlock CV · ${candidate.creditCosts.cv_download} credit`}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Analytics & Stats */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5" aria-hidden="true" />Profile and granted evidence summary</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div><p className="text-sm text-slate-500">Profile complete</p><p className="mt-1 text-2xl font-bold text-slate-950">{candidate.dedicationScore}%</p></div>
                  <div><p className="text-sm text-slate-500">Granted certifications</p><p className="mt-1 text-2xl font-bold text-slate-950">{selectedEvidence ? candidate.certificates.length : '—'}</p></div>
                  <div><p className="text-sm text-slate-500">Granted certification average</p><p className="mt-1 text-2xl font-bold text-slate-950">{selectedEvidence && candidate.certificates.length ? `${candidate.averageScore}%` : '—'}</p></div>
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-500">Profile completeness comes from candidate-provided fields. Certification figures appear only when covered by the active learner grant shown below.</p>
              </CardContent>
            </Card>

            <InterviewEvidenceNotice compact />

            {evidenceLoading ? (
              <Card><CardContent className="py-6 text-sm text-slate-600" role="status">Checking learner evidence grants…</CardContent></Card>
            ) : evidenceError ? (
              <Card className="border-amber-200 bg-amber-50" role="alert"><CardContent className="py-6"><p className="text-sm text-amber-950">Evidence authorization could not be checked: {evidenceError}</p><Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void fetchCandidateProfile(String(candidate.id))}>Retry authorization check</Button></CardContent></Card>
            ) : selectedEvidence ? (
              <Card className="border-emerald-200 bg-emerald-50/60">
                <CardHeader><CardTitle className="flex items-center"><Eye className="mr-2 h-5 w-5" aria-hidden="true" />Learner-authorized evidence</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-emerald-950"><strong>Purpose:</strong> {selectedEvidence.grant.purpose}</p>
                  {selectedEvidence.grant.jobReference && <p className="mt-1 text-sm text-emerald-900"><strong>Job reference:</strong> {selectedEvidence.grant.jobReference}</p>}
                  <p className="mt-2 text-xs text-emerald-800">Access expires {new Date(selectedEvidence.grant.expiresAt).toLocaleString()}. Every read is logged for the learner.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed border-slate-300"><CardContent className="py-6 text-sm text-slate-600">This learner has not granted your company access to selected evidence. Profile unlock does not disclose certification or Practice activity.</CardContent></Card>
            )}

            <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Award className="h-5 w-5 mr-2" />
                      Certifications ({candidate.certificates.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {candidate.certificates.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
                          No current credential evidence is available for this candidate.
                        </div>
                      ) : candidate.certificates.map((cert) => (
                        <div key={cert.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{cert.courseTitle}</h4>
                              <div className="flex items-center mt-2 space-x-4">
                                <Badge className={getBadgeColor(cert.badge)}>
                                  {cert.badge}
                                </Badge>
                                <span className="font-semibold text-slate-900">Score: {cert.score}%</span>
                              </div>
                              <div className="flex items-center mt-2 text-sm text-gray-500">
                                <Calendar className="h-4 w-4 mr-1" />
                                {new Date(cert.issuedAt).toLocaleDateString()}
                              </div>
                            </div>
                            <Trophy className={`h-6 w-6 ${cert.score >= 90 ? 'text-yellow-500' : 'text-gray-400'}`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
            </Card>

            {selectedEvidence && selectedEvidence.practiceSummaries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="mr-2 h-5 w-5" />
                    Selected Practice summaries ({selectedEvidence.practiceSummaries.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-slate-500">Practice is non-proctored and is not certification evidence. Answers and raw activity are not shared.</p>
                  {selectedEvidence.practiceSummaries.map((summary) => (
                    <div key={summary.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-medium text-gray-900">{summary.courseTitle}</h4>
                          <p className="mt-1 text-sm text-gray-600">{summary.score}% · {summary.totalQuestions} questions · {Math.max(1, Math.round(summary.durationSeconds / 60))} minute(s)</p>
                          <p className="mt-1 text-xs text-gray-500">Completed {new Date(summary.completedAt).toLocaleString()}</p>
                        </div>
                        <Badge variant="secondary">{summary.mastered ? "Mastered" : summary.passed ? "Passed" : "Completed"}</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
          <div className="space-y-6">
            {/* Contact & Availability */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Contact Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">Email</label>
                  <p className="font-medium">{candidate.email}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Availability</label>
                  <p className="font-medium">{candidate.availability}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Notice Period</label>
                  <p className="font-medium">{candidate.noticePeriod}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Expected Salary</label>
                  <p className="font-medium">{candidate.expectedSalary}</p>
                </div>
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Code className="h-5 w-5 mr-2" />
                  Technical Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(candidate.skills || []).length > 0 ? candidate.skills.map((skill) => (
                    <Badge key={skill} variant="secondary">{skill}</Badge>
                  )) : <p className="text-sm text-slate-500">No candidate-provided skills are available.</p>}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" onClick={handleDownloadCv} disabled={!candidate.hasResume}>
                  <Download className="h-4 w-4 mr-2" />
                  {!candidate.hasResume
                    ? 'CV not shared'
                    : candidate.cvAccessUnlocked
                      ? 'Download CV · unlocked'
                      : `Unlock CV · ${candidate.creditCosts.cv_download} credit`}
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <a href={`mailto:${candidate.email}?subject=${encodeURIComponent('Opportunity from Octamy Recruiter')}`}>
                    Contact candidate
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Profile completeness */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Profile completeness
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {candidate.dedicationScore}%
                  </div>
                  <Progress value={candidate.dedicationScore} className="mb-3" />
                  <p className="text-sm text-gray-600">
                    Based on candidate-provided profile fields.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

    </div></RecruiterLayout>
  );
}
