import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Users, Brain, Star, TrendingUp, Search, Filter, Calendar, MessageSquare } from "lucide-react";

interface DashboardData {
  totalCandidates: number;
  candidatesByStatus: Record<string, number>;
  recentActivity: Array<{
    id: number;
    candidateName: string;
    courseTitle: string;
    status: string;
    createdAt: string;
  }>;
}

interface Candidate {
  userId: number;
  name: string;
  email: string;
  experienceLevel: string;
  location: string;
  skills: string[];
  preferredJobTitle: string;
  expectedSalary: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  bio: string;
  cvFileName: string;
  examAttemptId: number;
  courseTitle: string;
  courseType: string;
  isPreferred: boolean;
  score: number;
  aiAnalysis: string;
  aiTotalScore: number;
  createdAt: string;
}

export default function RecruiterDashboard() {
  const { toast } = useToast();
  const [searchFilters, setSearchFilters] = useState({
    skills: "",
    experienceLevel: "",
    location: "",
    courseType: "",
    minScore: "",
    preferredCourses: false
  });
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [shortlistNotes, setShortlistNotes] = useState("");

  // Get recruiter token
  const getAuthHeaders = () => {
    const token = localStorage.getItem("recruiterToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Dashboard data
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ["/api/recruiters/dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/recruiters/dashboard", {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to fetch dashboard data");
      return response.json();
    }
  });

  // Search candidates
  const { data: candidates, isLoading: candidatesLoading, refetch: searchCandidates } = useQuery<{
    candidates: Candidate[];
    pagination: { page: number; limit: number; total: number };
  }>({
    queryKey: ["/api/recruiters/candidates/search", searchFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(searchFilters).forEach(([key, value]) => {
        if (value && value !== "") {
          params.append(key, value.toString());
        }
      });
      
      const response = await fetch(`/api/recruiters/candidates/search?${params}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to search candidates");
      return response.json();
    },
    enabled: false
  });

  // Shortlist candidate
  const shortlistMutation = useMutation({
    mutationFn: async ({ userId, examAttemptId, notes }: { userId: number; examAttemptId: number; notes: string }) => {
      return await apiRequest("/api/recruiters/candidates/shortlist", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId, examAttemptId, notes })
      });
    },
    onSuccess: () => {
      toast({
        title: "Candidate shortlisted",
        description: "Candidate has been added to your shortlist successfully."
      });
      setSelectedCandidate(null);
      setShortlistNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/recruiters/dashboard"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to shortlist candidate",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSearch = () => {
    searchCandidates();
  };

  const handleShortlist = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
  };

  const confirmShortlist = () => {
    if (selectedCandidate) {
      shortlistMutation.mutate({
        userId: selectedCandidate.userId,
        examAttemptId: selectedCandidate.examAttemptId,
        notes: shortlistNotes
      });
    }
  };

  const logout = () => {
    localStorage.removeItem("recruiterToken");
    localStorage.removeItem("recruiterData");
    window.location.href = "/recruiter-auth";
  };

  if (dashboardLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Octamy Recruiter Portal</h1>
            <p className="text-gray-400">AI-Powered Talent Assessment Platform</p>
          </div>
          <Button onClick={logout} variant="outline" className="border-gray-700">
            Logout
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-gray-900">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="search">Search Candidates</TabsTrigger>
            <TabsTrigger value="shortlisted">Shortlisted</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">Total Candidates</CardTitle>
                  <Users className="h-4 w-4 text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{dashboardData?.totalCandidates || 0}</div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">AI Assessments</CardTitle>
                  <Brain className="h-4 w-4 text-purple-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {dashboardData?.candidatesByStatus?.interested || 0}
                  </div>
                  <p className="text-xs text-gray-500">Ready for review</p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">Contacted</CardTitle>
                  <MessageSquare className="h-4 w-4 text-green-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {dashboardData?.candidatesByStatus?.contacted || 0}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">Interviewing</CardTitle>
                  <Calendar className="h-4 w-4 text-yellow-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {dashboardData?.candidatesByStatus?.interviewing || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Recent Activity</CardTitle>
                <CardDescription>Latest candidate interactions and assessments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardData?.recentActivity?.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div>
                        <p className="font-medium text-white">{activity.candidateName}</p>
                        <p className="text-sm text-gray-400">{activity.courseTitle}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={activity.status === 'interested' ? 'default' : 'secondary'}>
                          {activity.status}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(activity.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="search">
            <Card className="bg-gray-900 border-gray-800 mb-6">
              <CardHeader>
                <CardTitle className="text-white">Search Candidates</CardTitle>
                <CardDescription>Find candidates based on skills, experience, and AI assessment results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <Label htmlFor="skills" className="text-white">Skills</Label>
                    <Input
                      id="skills"
                      placeholder="React, Python, AI..."
                      value={searchFilters.skills}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, skills: e.target.value }))}
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                  <div>
                    <Label htmlFor="experience" className="text-white">Experience Level</Label>
                    <Select onValueChange={(value) => setSearchFilters(prev => ({ ...prev, experienceLevel: value }))}>
                      <SelectTrigger className="bg-gray-800 border-gray-700">
                        <SelectValue placeholder="Any level" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="any">Any level</SelectItem>
                        <SelectItem value="fresher">Fresher</SelectItem>
                        <SelectItem value="junior">Junior</SelectItem>
                        <SelectItem value="mid">Mid-level</SelectItem>
                        <SelectItem value="senior">Senior</SelectItem>
                        <SelectItem value="lead">Lead</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="location" className="text-white">Location</Label>
                    <Input
                      id="location"
                      placeholder="City, Country"
                      value={searchFilters.location}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, location: e.target.value }))}
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <Label htmlFor="courseType" className="text-white">Assessment Type</Label>
                    <Select onValueChange={(value) => setSearchFilters(prev => ({ ...prev, courseType: value }))}>
                      <SelectTrigger className="bg-gray-800 border-gray-700">
                        <SelectValue placeholder="Any type" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="any">Any type</SelectItem>
                        <SelectItem value="ai_interactive">AI Interactive</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="minScore" className="text-white">Minimum Score</Label>
                    <Input
                      id="minScore"
                      type="number"
                      placeholder="70"
                      value={searchFilters.minScore}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, minScore: e.target.value }))}
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleSearch} disabled={candidatesLoading} className="bg-blue-600 hover:bg-blue-700">
                      <Search className="w-4 h-4 mr-2" />
                      {candidatesLoading ? "Searching..." : "Search"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {candidates && (
              <div className="space-y-4">
                {candidates.candidates.map((candidate) => (
                  <Card key={candidate.userId} className="bg-gray-900 border-gray-800">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-white">{candidate.name}</h3>
                            {candidate.isPreferred && (
                              <Badge className="bg-yellow-600">
                                <Star className="w-3 h-3 mr-1" />
                                Preferred
                              </Badge>
                            )}
                            {candidate.courseType === 'ai_interactive' && (
                              <Badge className="bg-purple-600">
                                <Brain className="w-3 h-3 mr-1" />
                                AI Assessment
                              </Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-gray-400">Experience: <span className="text-white">{candidate.experienceLevel}</span></p>
                              <p className="text-gray-400">Location: <span className="text-white">{candidate.location}</span></p>
                              <p className="text-gray-400">Role: <span className="text-white">{candidate.preferredJobTitle}</span></p>
                            </div>
                            <div>
                              <p className="text-gray-400">Course: <span className="text-white">{candidate.courseTitle}</span></p>
                              <p className="text-gray-400">Score: <span className="text-white font-semibold">{candidate.score}%</span></p>
                              {candidate.aiTotalScore && (
                                <p className="text-gray-400">AI Score: <span className="text-white font-semibold">{candidate.aiTotalScore}</span></p>
                              )}
                            </div>
                          </div>

                          {candidate.skills && candidate.skills.length > 0 && (
                            <div className="mb-4">
                              <p className="text-gray-400 mb-2">Skills:</p>
                              <div className="flex flex-wrap gap-2">
                                {candidate.skills.map((skill, index) => (
                                  <Badge key={index} variant="outline" className="border-gray-600 text-gray-300">
                                    {skill}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {candidate.aiAnalysis && (
                            <div className="mb-4">
                              <p className="text-gray-400 mb-2">AI Analysis:</p>
                              <p className="text-sm text-gray-300 bg-gray-800 p-3 rounded">
                                {candidate.aiAnalysis}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="ml-4 space-y-2">
                          <Button
                            onClick={() => handleShortlist(candidate)}
                            disabled={shortlistMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Shortlist
                          </Button>
                          {candidate.linkedinUrl && (
                            <Button
                              variant="outline"
                              onClick={() => window.open(candidate.linkedinUrl, '_blank')}
                              className="w-full border-gray-600"
                            >
                              LinkedIn
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="shortlisted">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Shortlisted Candidates</CardTitle>
                <CardDescription>Manage your candidate pipeline</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">Shortlisted candidates will appear here...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Shortlist Dialog */}
      <Dialog open={!!selectedCandidate} onOpenChange={() => setSelectedCandidate(null)}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Shortlist Candidate</DialogTitle>
            <DialogDescription className="text-gray-400">
              Add {selectedCandidate?.name} to your shortlist
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="notes" className="text-white">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add notes about this candidate..."
                value={shortlistNotes}
                onChange={(e) => setShortlistNotes(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setSelectedCandidate(null)}>
                Cancel
              </Button>
              <Button
                onClick={confirmShortlist}
                disabled={shortlistMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {shortlistMutation.isPending ? "Adding..." : "Add to Shortlist"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}