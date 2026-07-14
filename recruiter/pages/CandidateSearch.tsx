import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import RecruiterLayout from '../components/RecruiterLayout';
import { useRecruiterAuth } from '../auth/RecruiterAuthProvider';
import { downloadCandidateCv } from '../utils/downloadCandidateCv';
import {
  Search,
  Filter,
  Eye,
  Download,
  MapPin,
  Calendar,
  Briefcase,
  Star,
  Award,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  CreditCard,
  Check,
  LockKeyhole,
  AlertCircle,
} from 'lucide-react';

interface SearchFilters {
  technology: string[];
  location: string;
  experience: { min: number | ''; max: number | '' };
  noticePeriod: string;
  workType: string[];
  availability: string;
  skills: string[];
  category: string[];
  minScore: number;
  hasCertificates: boolean;
  hasInterviews: boolean;
}

interface Candidate {
  id: number;
  name: string;
  location: string;
  experience: number;
  currentRole: string;
  skills: string[];
  certificates: Array<{
    id: number;
    courseTitle: string;
    score: number;
    badge: string;
  }>;
  interviewCount: number;
  hasResume: boolean;
  access: { profile: boolean; cv: boolean; interview: boolean };
  lastActive: string;
}

type CreditCosts = { profile_view: number; cv_download: number; interview_access: number };

const TECHNOLOGIES = [
  'JavaScript', 'Python', 'React', 'Node.js', 'Java', 'C++', 'Angular',
  'Vue.js', 'TypeScript', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin'
];

const WORK_TYPES = ['Remote', 'On-site', 'Hybrid'];
const NOTICE_PERIODS = ['Immediate', '15 days', '30 days', '60 days', '90 days'];
const CATEGORIES = ['AI', 'Development', 'Business', 'Data Science', 'DevOps'];

export default function CandidateSearch() {
  const { toast } = useToast();
  const { recruiter, updateRecruiter } = useRecruiterAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [creditCosts, setCreditCosts] = useState<CreditCosts>({ profile_view: 1, cv_download: 1, interview_access: 2 });
  const [searchError, setSearchError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState<string | null>(null);

  const [filters, setFilters] = useState<SearchFilters>(() => {
    const params = new URLSearchParams(window.location.search);
    const savedSkills = (params.get('skills') || '').split(',').map((skill) => skill.trim()).filter(Boolean);
    const savedMinScore = Number(params.get('minScore'));
    return {
      technology: [],
      location: '',
      experience: { min: '', max: '' },
      noticePeriod: '',
      workType: [],
      availability: '',
      skills: savedSkills,
      category: [],
      minScore: Number.isFinite(savedMinScore) ? Math.min(100, Math.max(0, savedMinScore)) : 0,
      hasCertificates: false,
      hasInterviews: false,
    };
  });

  const searchCandidates = async (page = 1) => {
    setLoading(true);
    setSearchError(null);
    try {
      const response = await fetch('/api/recruiter/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('recruiterToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filters,
          page,
          limit: 10,
        })
      });

      if (response.ok) {
        const searchData = await response.json();
        
        setCandidates(searchData.candidates || []);
        setTotalResults(searchData.total || searchData.candidates?.length || 0);
        setCurrentPage(page);
        if (searchData.creditCosts) setCreditCosts(searchData.creditCosts);
        return;
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Search API error:', errorData);
        
        setSearchError(errorData.message || 'Candidate search is temporarily unavailable.');
        setCandidates([]);
        setTotalResults(0);
        setCurrentPage(1);
        return;
      }
      
    } catch (error) {
      console.error('Search Error Details:', error);
      setCandidates([]);
      setTotalResults(0);
      
      setSearchError('We could not reach candidate search. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccessProfile = async (candidateId: number, accessType: 'view' | 'cv' | 'interview') => {
    const unlockKey = `${candidateId}:${accessType}`;
    setUnlocking(unlockKey);
    try {
      const response = await apiRequest('POST', '/api/recruiter/access-profile', {
        candidateId,
        accessType,
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: data.alreadyUnlocked ? 'Already unlocked' : 'Workspace access unlocked',
          description: data.message || `${data.creditsUsed} credits used. Balance: ${data.remainingCredits}`,
        });
        updateRecruiter({ creditsBalance: data.remainingCredits });
        setCandidates((current) => current.map((candidate) => candidate.id === candidateId
          ? {
              ...candidate,
              access: {
                ...candidate.access,
                [accessType === 'view' ? 'profile' : accessType]: true,
              },
            }
          : candidate));
        
        // Handle the accessed data based on type
        if (accessType === 'view') {
          window.location.href = `/recruiter/profile/${candidateId}`;
        } else if (accessType === 'cv') {
          // Download CV
          if (!data.cvUrl) throw new Error('Candidate CV is not available');
          await downloadCandidateCv(data.cvUrl, candidateId);
        } else if (accessType === 'interview') {
          window.location.href = `/recruiter/profile/${candidateId}`;
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }
    } catch (error) {
      toast({
        title: 'Unlock not completed',
        description: error instanceof Error ? error.message : 'Failed to access profile',
      });
    } finally {
      setUnlocking(null);
    }
  };

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const addArrayFilter = (key: keyof SearchFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: [...(prev[key] as string[]), value]
    }));
  };

  const removeArrayFilter = (key: keyof SearchFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: (prev[key] as string[]).filter(item => item !== value)
    }));
  };

  useEffect(() => {
    searchCandidates();
  }, []);

  return (
    <RecruiterLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Consent-gated talent evidence</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">Search candidates</h1>
            <p className="text-gray-600 mt-2 max-w-2xl">
              Every result has learner consent and at least one paid, active, unexpired Octamy credential.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2"
          >
            <Filter className="h-4 w-4" />
            <span>{showFilters ? 'Hide' : 'Show'} Filters</span>
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="grid gap-4 p-0 md:grid-cols-[1fr_auto] md:items-stretch">
            <div className="flex gap-3 p-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-950">Search is free. Candidate data uses one-time unlocks.</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Profile {creditCosts.profile_view} credit · CV {creditCosts.cv_download} credit · Interview evidence {creditCosts.interview_access} credits. Reopening the same item costs 0 credits. If a learner withdraws consent, access stops immediately.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-5 py-4 md:min-w-52 md:border-l md:border-t-0">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Wallet balance</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{Number(recruiter?.creditsBalance || 0).toLocaleString()} <span className="text-sm font-medium text-slate-500">credits</span></p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { window.location.href = '/recruiter/wallet'; }}>
                <CreditCard className="mr-2 h-4 w-4" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {searchError ? (
          <Card className="border-amber-200 bg-amber-50/70">
            <CardContent className="flex flex-col gap-3 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{searchError}</span>
              <Button size="sm" variant="outline" onClick={() => searchCandidates(currentPage)}>Retry search</Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Advanced Filters */}
        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Filter className="h-5 w-5" />
                <span>Advanced Filters</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    placeholder="City, State, Country"
                    value={filters.location}
                    onChange={(e) => updateFilter('location', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notice Period</Label>
                  <Select value={filters.noticePeriod} onValueChange={(value) => updateFilter('noticePeriod', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select notice period" />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTICE_PERIODS.map((period) => (
                        <SelectItem key={period} value={period}>
                          {period}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Minimum Score</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={filters.minScore}
                    onChange={(e) => updateFilter('minScore', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Experience Range */}
              <div className="space-y-2">
                <Label>Experience (Years)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-600">Minimum</Label>
                    <Input
                      type="number"
                      min="0"
                      value={filters.experience.min}
                      onChange={(e) => updateFilter('experience', {
                        ...filters.experience,
                        min: e.target.value === '' ? '' : Math.max(0, Number(e.target.value))
                      })}
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Maximum</Label>
                    <Input
                      type="number"
                      min="0"
                      value={filters.experience.max}
                      onChange={(e) => updateFilter('experience', {
                        ...filters.experience,
                        max: e.target.value === '' ? '' : Math.max(0, Number(e.target.value))
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Technologies */}
              <div className="space-y-2">
                <Label>Technologies</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {filters.technology.map((tech) => (
                    <Badge key={tech} variant="secondary" className="cursor-pointer">
                      {tech}
                      <button
                        onClick={() => removeArrayFilter('technology', tech)}
                        className="ml-2 text-gray-500 hover:text-gray-700"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                <Select onValueChange={(value) => addArrayFilter('technology', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add technology" />
                  </SelectTrigger>
                  <SelectContent>
                    {TECHNOLOGIES.filter(tech => !filters.technology.includes(tech)).map((tech) => (
                      <SelectItem key={tech} value={tech}>
                        {tech}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Work Type */}
              <div className="space-y-2">
                <Label>Work Type</Label>
                <div className="flex space-x-4">
                  {WORK_TYPES.map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={type}
                        checked={filters.workType.includes(type)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            addArrayFilter('workType', type);
                          } else {
                            removeArrayFilter('workType', type);
                          }
                        }}
                      />
                      <Label htmlFor={type}>{type}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Categories */}
              <div className="space-y-2">
                <Label>Categories</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {filters.category.map((cat) => (
                    <Badge key={cat} variant="secondary" className="cursor-pointer">
                      {cat}
                      <button
                        onClick={() => removeArrayFilter('category', cat)}
                        className="ml-2 text-gray-500 hover:text-gray-700"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                <Select onValueChange={(value) => addArrayFilter('category', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.filter(cat => !filters.category.includes(cat)).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Additional Filters */}
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                  <Check className="h-4 w-4" /> Current paid evidence required
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasInterviews"
                    checked={filters.hasInterviews}
                    onCheckedChange={(checked) => updateFilter('hasInterviews', checked)}
                  />
                  <Label htmlFor="hasInterviews">Has Interview Data</Label>
                </div>
              </div>

              <div className="flex space-x-4">
                <Button onClick={() => searchCandidates(1)} className="bg-blue-600 hover:bg-blue-700">
                  <Search className="h-4 w-4 mr-2" />
                  Search Candidates
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters({
                      technology: [],
                      location: '',
                      experience: { min: '', max: '' },
                      noticePeriod: '',
                      workType: [],
                      availability: '',
                      skills: [],
                      category: [],
                      minScore: 0,
                      hasCertificates: false,
                      hasInterviews: false,
                    });
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Results */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-600">
              {loading ? 'Searching...' : `${totalResults} candidates found`}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white text-center py-12">
              <div className="text-gray-500 mb-4">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <h3 className="text-lg font-medium text-slate-900">No eligible candidates match</h3>
                <p className="mx-auto mt-1 max-w-lg text-sm">Try broader filters. Profiles remain absent until the learner opts in and has current paid evidence; active institute affiliations also require institute opt-in.</p>
              </div>
              <Button 
                onClick={() => searchCandidates(1)} 
                variant="outline"
                className="mt-4"
              >
                Search Again
              </Button>
            </div>
          ) : (
            <div className="grid gap-6">
              {candidates.map((candidate) => (
                <Card key={candidate.id} className="overflow-hidden border-slate-200 transition-shadow hover:shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-semibold text-gray-900">{candidate.name}</h3>
                          <Badge variant="outline">{candidate.experience || 0} years exp</Badge>
                          <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"><ShieldCheck className="mr-1 h-3 w-3" />Consent + evidence eligible</Badge>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center space-x-2 text-gray-600">
                            <Briefcase className="h-4 w-4" />
                            <span>{candidate.currentRole || 'Role not provided'}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-gray-600">
                            <MapPin className="h-4 w-4" />
                            <span>{candidate.location || 'Location not provided'}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-gray-600">
                            <Calendar className="h-4 w-4" />
                            <span>Last active: {candidate.lastActive ? new Date(candidate.lastActive).toLocaleDateString() : 'Not available'}</span>
                          </div>
                        </div>

                        {/* Skills */}
                        <div className="mb-4">
                          <Label className="text-sm font-medium">Skills</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(candidate.skills || []).slice(0, 6).map((skill) => (
                              <Badge key={skill} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {(candidate.skills || []).length > 6 && (
                              <Badge variant="outline" className="text-xs">
                                +{(candidate.skills || []).length - 6} more
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Certificates and Interviews */}
                        <div className="mb-4 grid gap-4 sm:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                            <Label className="text-sm font-medium flex items-center space-x-1">
                              <Award className="h-4 w-4" />
                              <span>Current credential evidence</span>
                            </Label>
                            {candidate.certificates.slice(0, 2).map((cert) => (
                              <div key={cert.id} className="text-sm text-gray-600 mt-1">
                                {cert.courseTitle} · {cert.score}% · {cert.badge}
                              </div>
                            ))}
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                            <Label className="text-sm font-medium flex items-center space-x-1">
                              <Star className="h-4 w-4" />
                              <span>Interview evidence</span>
                            </Label>
                            <p className="mt-1 text-sm text-slate-600">{candidate.interviewCount || 0} completed record{candidate.interviewCount === 1 ? '' : 's'}{candidate.access.interview ? ' · unlocked' : ''}</p>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid shrink-0 gap-2 sm:grid-cols-3 lg:w-52 lg:grid-cols-1">
                        <Button
                          size="sm"
                          className="bg-slate-950 text-white hover:bg-slate-800"
                          onClick={() => handleAccessProfile(candidate.id, 'view')}
                          disabled={unlocking === `${candidate.id}:view`}
                        >
                          {candidate.access.profile ? <Eye className="mr-2 h-4 w-4" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
                          <span>{candidate.access.profile ? 'Open profile' : `Unlock profile · ${creditCosts.profile_view}`}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-300 text-slate-800"
                          onClick={() => handleAccessProfile(candidate.id, 'cv')}
                          disabled={!candidate.hasResume || unlocking === `${candidate.id}:cv`}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          <span>{!candidate.hasResume ? 'CV not shared' : candidate.access.cv ? 'Download CV' : `Unlock CV · ${creditCosts.cv_download}`}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-300 text-slate-800"
                          onClick={() => handleAccessProfile(candidate.id, 'interview')}
                          disabled={!candidate.interviewCount || unlocking === `${candidate.id}:interview`}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          <span>{!candidate.interviewCount ? 'No interview evidence' : candidate.access.interview ? 'Open interviews' : `Unlock interviews · ${creditCosts.interview_access}`}</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalResults > 10 && (
            <div className="flex items-center justify-center space-x-2 mt-6">
              <Button
                variant="outline"
                onClick={() => searchCandidates(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {Math.ceil(totalResults / 10)}
              </span>
              <Button
                variant="outline"
                onClick={() => searchCandidates(currentPage + 1)}
                disabled={currentPage >= Math.ceil(totalResults / 10)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </RecruiterLayout>
  );
}
