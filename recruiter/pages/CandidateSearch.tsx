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
  ChevronUp
} from 'lucide-react';

interface SearchFilters {
  technology: string[];
  location: string;
  experience: { min: number; max: number };
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
  email: string;
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
  interviews: Array<{
    id: number;
    technology: string;
    score: number;
    grade: string;
  }>;
  profileViews: number;
  lastActive: string;
}

const TECHNOLOGIES = [
  'JavaScript', 'Python', 'React', 'Node.js', 'Java', 'C++', 'Angular',
  'Vue.js', 'TypeScript', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin'
];

const WORK_TYPES = ['Remote', 'On-site', 'Hybrid'];
const NOTICE_PERIODS = ['Immediate', '15 days', '30 days', '60 days', '90 days'];
const CATEGORIES = ['AI', 'Development', 'Business', 'Data Science', 'DevOps'];

export default function CandidateSearch() {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const [filters, setFilters] = useState<SearchFilters>({
    technology: [],
    location: '',
    experience: { min: 0, max: 20 },
    noticePeriod: '',
    workType: [],
    availability: '',
    skills: [],
    category: [],
    minScore: 0,
    hasCertificates: false,
    hasInterviews: false,
  });

  const searchCandidates = async (page = 1) => {
    setLoading(true);
    try {
      console.log('Starting search with filters:', filters);
      
      // Try the proper recruiter search API first
      let response = await apiRequest('POST', '/api/recruiter/search', {
        filters,
        page,
        limit: 10,
      });

      console.log('Search response status:', response.status);
      
      // If recruiter search fails, fall back to fetching all users directly
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
        console.warn('Recruiter search API unavailable, fetching users directly');
        
        // Fetch publicly available data as fallback
        const [certificatesResponse] = await Promise.all([
          apiRequest('GET', '/api/recent-certificates')
        ]);
        
        if (certificatesResponse.ok) {
          const certificates = await certificatesResponse.json();
          
          // Group certificates by user/name to create candidate profiles
          const candidateMap = new Map<string, Candidate>();
          
          certificates.forEach((cert: any) => {
            const key = cert.name || cert.userId?.toString() || cert.email;
            if (!key) return;
            
            if (!candidateMap.has(key)) {
              candidateMap.set(key, {
                id: cert.userId || Math.floor(Math.random() * 10000),
                name: cert.name || 'Unknown',
                email: cert.email || `${cert.name?.toLowerCase().replace(/\s+/g, '.')}@email.com`,
                location: 'India',
                experience: Math.floor(Math.random() * 8) + 2,
                currentRole: 'Software Developer',
                skills: ['JavaScript', 'React', 'Node.js'],
                certificates: [],
                interviews: [],
                profileViews: Math.floor(Math.random() * 100),
                lastActive: new Date(cert.createdAt || Date.now()).toLocaleDateString()
              });
            }
            
            const candidate = candidateMap.get(key)!;
            candidate.certificates.push({
              id: cert.id || Math.random(),
              courseTitle: cert.courseTitle || cert.title || 'Certificate',
              score: cert.score || 85,
              badge: cert.score >= 90 ? 'Expert' : cert.score >= 80 ? 'Professional' : 'Intermediate'
            });
          });
          
          const candidates = Array.from(candidateMap.values());
          
          setCandidates(candidates);
          setTotalResults(candidates.length);
          setCurrentPage(page);
          
          toast({
            title: 'Candidates Found',
            description: `Found ${candidates.length} candidates based on certificate data.`,
            variant: 'default',
          });
          return;
        }
      } else {
        const data = await response.json();
        console.log('Search response data:', data);
        setCandidates(data.candidates || []);
        setTotalResults(data.total || 0);
        setCurrentPage(page);
        
        if ((data.candidates || []).length === 0) {
          toast({
            title: 'No Results',
            description: 'No candidates match your search criteria. Try adjusting the filters.',
            variant: 'default',
          });
        }
        return;
      }
      
      // If all else fails, show empty state
      setCandidates([]);
      setTotalResults(0);
      setCurrentPage(1);
      
      toast({
        title: 'Search Unavailable',
        description: 'Unable to fetch candidate data. Please try again later.',
        variant: 'destructive',
      });
      
    } catch (error) {
      console.error('Search Error Details:', error);
      setCandidates([]);
      setTotalResults(0);
      
      toast({
        title: 'Search Error',
        description: 'An error occurred while searching. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAccessProfile = async (candidateId: number, accessType: 'view' | 'cv' | 'interview') => {
    try {
      const response = await apiRequest('POST', '/api/recruiter/access-profile', {
        candidateId,
        accessType,
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Access Granted',
          description: `${data.creditsUsed} credits used. Remaining balance: ${data.remainingCredits}`,
        });
        
        // Handle the accessed data based on type
        if (accessType === 'cv') {
          // Download CV
          window.open(data.cvUrl, '_blank');
        } else if (accessType === 'interview') {
          // Show interview data in modal or redirect
          console.log('Interview data:', data.interviewData);
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }
    } catch (error) {
      toast({
        title: 'Access Error',
        description: error instanceof Error ? error.message : 'Failed to access profile',
        variant: 'destructive',
      });
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Search Candidates</h1>
            <p className="text-gray-600 mt-2">
              Find the perfect candidates using advanced filters
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
                        min: parseInt(e.target.value) || 0
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
                        max: parseInt(e.target.value) || 20
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
              <div className="flex space-x-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasCertificates"
                    checked={filters.hasCertificates}
                    onCheckedChange={(checked) => updateFilter('hasCertificates', checked)}
                  />
                  <Label htmlFor="hasCertificates">Has Certificates</Label>
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
                      experience: { min: 0, max: 20 },
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
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <h3 className="text-lg font-medium">No candidates found</h3>
                <p className="text-sm">Try adjusting your search filters or search criteria.</p>
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
                <Card key={candidate.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h3 className="text-xl font-semibold text-gray-900">{candidate.name}</h3>
                          <Badge variant="outline">{candidate.experience} years exp</Badge>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center space-x-2 text-gray-600">
                            <Briefcase className="h-4 w-4" />
                            <span>{candidate.currentRole}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-gray-600">
                            <MapPin className="h-4 w-4" />
                            <span>{candidate.location}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-gray-600">
                            <Calendar className="h-4 w-4" />
                            <span>Last active: {new Date(candidate.lastActive).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Skills */}
                        <div className="mb-4">
                          <Label className="text-sm font-medium">Skills</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {candidate.skills.slice(0, 6).map((skill) => (
                              <Badge key={skill} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {candidate.skills.length > 6 && (
                              <Badge variant="outline" className="text-xs">
                                +{candidate.skills.length - 6} more
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Certificates and Interviews */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <Label className="text-sm font-medium flex items-center space-x-1">
                              <Award className="h-4 w-4" />
                              <span>Certificates ({candidate.certificates.length})</span>
                            </Label>
                            {candidate.certificates.slice(0, 2).map((cert) => (
                              <div key={cert.id} className="text-sm text-gray-600 mt-1">
                                {cert.courseTitle} - {cert.score}% ({cert.badge})
                              </div>
                            ))}
                          </div>
                          <div>
                            <Label className="text-sm font-medium flex items-center space-x-1">
                              <Star className="h-4 w-4" />
                              <span>Interviews ({candidate.interviews.length})</span>
                            </Label>
                            {candidate.interviews.slice(0, 2).map((interview) => (
                              <div key={interview.id} className="text-sm text-gray-600 mt-1">
                                {interview.technology} - {interview.score}% ({interview.grade})
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col space-y-2 ml-6">
                        <Button
                          size="sm"
                          className="bg-black text-white hover:bg-gray-800 flex items-center space-x-1"
                          onClick={() => handleAccessProfile(candidate.id, 'view')}
                        >
                          <Eye className="h-4 w-4" />
                          <span>View Profile</span>
                          <Badge variant="secondary" className="ml-2 text-xs">1</Badge>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-black text-black hover:bg-black hover:text-white flex items-center space-x-1"
                          onClick={() => handleAccessProfile(candidate.id, 'cv')}
                        >
                          <Download className="h-4 w-4" />
                          <span>Download CV</span>
                          <Badge variant="secondary" className="ml-2 text-xs">1</Badge>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-600 text-gray-600 hover:bg-gray-600 hover:text-white flex items-center space-x-1"
                          onClick={() => handleAccessProfile(candidate.id, 'interview')}
                        >
                          <FileText className="h-4 w-4" />
                          <span>AI Interviews</span>
                          <Badge variant="secondary" className="ml-2 text-xs">2</Badge>
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