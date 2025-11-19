import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth.tsx";
import { Link, useLocation } from "wouter";
import Header from "@/components/header";
import Footer from "@/components/footer";
import PaymentModal from "@/components/PaymentModal";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Download,
  Eye,
  Calendar,
  Trophy,
  Award,
  AlertCircle,
  Brain,
  TrendingUp,
  DollarSign,
  Play,
  ArrowRight,
  Edit,
  History,
  RefreshCcw,
  CheckCircle,
  XCircle,
  BarChart3,
  BookOpen,
  Share2,
  Lock,
} from "lucide-react";
import type { Certificate, Interview, ExamAttempt } from "@shared/schema";

// Extended type with enriched course data from backend
type EnrichedExamAttempt = ExamAttempt & {
  courseTitle: string;
  courseCategory: string;
};
import DashboardAnalytics from "@/components/dashboard-analytics";
import { useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { user, token, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<{ id: number; courseTitle: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [isLoading, user, setLocation]);

  // Handle payment success from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    const paymentStatus = params.get('payment');
    const attemptId = params.get('attemptId');

    if (paymentStatus === 'success' && attemptId) {
      toast({
        title: "Payment Successful!",
        description: "Your exam results have been unlocked. Scroll down to view your results.",
        duration: 5000,
      });

      // Invalidate queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ["/api/user/exam-attempts"] });

      // Clean up URL
      setLocation('/dashboard');
    }
  }, [location, toast, setLocation]);

  // Redirect to login if not authenticated
  // if (!isLoading && !user) {
  //   setLocation('/login');
  //   return null;
  // }

  const {
    data: certificates = [],
    isLoading: certificatesLoading,
    error: certificatesError,
  } = useQuery<Certificate[]>({
    queryKey: ["/api/user/certificates"],
    enabled: !!user && !!token,
  });

  // Fetch user's interviews
  const { data: userInterviews = [] } = useQuery<Interview[]>({
    queryKey: ["/api/user/interviews"],
    enabled: !!user && !!token,
  });

  // Fetch user's profile to get completeness
  const { data: userProfile } = useQuery({
    queryKey: ["/api/user/profile"],
    enabled: !!user && !!token,
  });

  // Fetch user's exam attempts for improvement tracking
  const { data: examAttempts = [] } = useQuery<EnrichedExamAttempt[]>({
    queryKey: ["/api/user/exam-attempts"],
    enabled: !!user && !!token,
  });

  // Debug logging for certificate data
  console.log("Dashboard certificates data:", {
    certificates,
    certificatesLoading,
    certificatesError,
  });

  // Show debug info if certificates are loading or failed
  if (certificatesLoading) {
    console.log("Loading certificates...");
  }

  if (certificatesError) {
    console.error("Certificate loading error:", certificatesError);
  }

  const handleDownload = async (certificateId: string) => {
    try {
      // Open certificate in new tab for printing/saving as PDF
      const downloadUrl = `/api/certificates/${certificateId}/download`;
      window.open(downloadUrl, "_blank");
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download certificate. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardContent className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-premcq-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-premcq-black mb-2">
                Login Required
              </h2>
              <p className="text-premcq-gray-600 mb-6">
                Please log in to view your certificate dashboard.
              </p>
              <Link href="/auth">
                <Button className="bg-premcq-black text-white hover:bg-premcq-gray-800" data-testid="button-login">
                  Login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  // CERTIFICATE DISPLAY LOGIC FOR DEVELOPERS:
  // Dashboard shows certificates in three categories based on status and payment

  // 1. Active Certificates: Paid certificates that haven't expired yet
  // These are the user's valid, downloadable certificates
  const activeCertificates = certificates.filter(
    (cert) =>
      cert.isActive && cert.isPaid && new Date(cert.expiresAt) > new Date()
  );

  // 2. Expired Certificates: Paid certificates that have passed their expiry date
  // These were valid certificates but are no longer current
  const expiredCertificates = certificates.filter(
    (cert) =>
      cert.isActive && cert.isPaid && new Date(cert.expiresAt) <= new Date()
  );

  // 3. Unpaid Certificates: Certificates created after passing exams but not yet purchased
  // Users need to complete payment to activate these certificates
  const unpaidCertificates = certificates.filter((cert) => !cert.isPaid);

  // Calculate money saved (difference between original price and paid price)
  const moneySaved = certificates.reduce((total, cert) => {
    if (cert.isPaid) {
      const originalPrice = 199; // Assuming original price is ₹199
      const paidPrice = 99; // User paid ₹99
      return total + (originalPrice - paidPrice);
    }
    return total;
  }, 0);

  // Calculate average score
  const averageScore =
    certificates.length > 0
      ? Math.round(
          certificates.reduce((acc, cert) => acc + cert.score, 0) /
            certificates.length
        )
      : 0;

  // Get recent interviews (last 3)
  const recentInterviews = userInterviews
    .filter((interview) => interview?.status === "completed")
    .sort(
      (a, b) =>
        new Date(b?.completedAt!)?.getTime() -
        new Date(a.completedAt!).getTime()
    )
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex items-center md:flex-row flex-col justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-black mb-2">
                Welcome back, {user.name}!
              </h1>
              <p className="text-xl text-gray-600">
                Manage your certificates and track your progress
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/profile-edit">
                <Button
                  variant="outline"
                  className="border-black text-black hover:bg-black hover:text-white"
                  data-testid="button-edit-profile"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  {userProfile?.profileCompleteness === 100 ? "Edit Profile" : "Complete Profile"}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Key Performance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-2 border-black">
            <CardContent className="p-6 text-center bg-gradient-to-br from-gray-50 to-white">
              <Award className="w-10 h-10 text-black mx-auto mb-3" />
              <div className="text-3xl font-bold text-black">
                {certificates.length}
              </div>
              <div className="text-sm text-gray-600 font-medium">
                Total Certificates
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-black">
            <CardContent className="p-6 text-center bg-gradient-to-br from-gray-50 to-white">
              <Trophy className="w-10 h-10 text-black mx-auto mb-3" />
              <div className="text-3xl font-bold text-black">
                {activeCertificates.length}
              </div>
              <div className="text-sm text-gray-600 font-medium">
                Active Certifications
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-black">
            <CardContent className="p-6 text-center bg-gradient-to-br from-gray-50 to-white">
              <DollarSign className="w-10 h-10 text-black mx-auto mb-3" />
              <div className="text-3xl font-bold text-black">₹{moneySaved}</div>
              <div className="text-sm text-gray-600 font-medium">
                Money Saved
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-black">
            <CardContent className="p-6 text-center bg-gradient-to-br from-gray-50 to-white">
              <TrendingUp className="w-10 h-10 text-black mx-auto mb-3" />
              <div className="text-3xl font-bold text-black">
                {averageScore}%
              </div>
              <div className="text-sm text-gray-600 font-medium">
                Average Score
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Certificates Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-black mb-6">
            Your Certificates
          </h2>

          {/* Active Certificates */}
          {activeCertificates.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-black mb-4">
                Active Certificates
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeCertificates.map((certificate) => (
                  <Card
                    key={certificate.id}
                    className="border-2 border-green-500 hover:shadow-lg transition-shadow"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-green-100 text-green-800 font-medium">
                          Active
                        </Badge>
                        <Trophy className="w-5 h-5 text-green-600" />
                      </div>
                      <CardTitle className="text-lg text-black">
                        {certificate.courseTitle}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Score:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-black">
                            {certificate.score}%
                          </span>
                          {certificate.mastered && (
                            <Badge className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                              Master
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Expires:</span>
                        <span className="font-semibold text-black">
                          {certificate?.courseTitle
                            ?.toLowerCase()
                            ?.includes("internship")
                            ? "Never"
                            : new Date(
                                certificate.expiresAt
                              ).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            window.open(
                              `/certificate/${certificate.certificateId}`,
                              "_blank"
                            )
                          }
                          className="flex-1 border-black text-black hover:bg-gray-100"
                          data-testid={`button-view-certificate-${certificate.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            handleDownload(certificate.certificateId)
                          }
                          className="flex-1 bg-black text-white hover:bg-gray-800"
                          data-testid={`button-download-certificate-${certificate.id}`}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const shareUrl = `${window.location.origin}/certificate/${certificate.certificateId}`;
                            if (navigator.share) {
                              navigator.share({
                                title: `Professional Certificate - ${certificate.userName}`,
                                text: `Certificate of completion for ${certificate.courseTitle}`,
                                url: shareUrl,
                              });
                            } else {
                              navigator.clipboard.writeText(shareUrl);
                              alert("Shareable link copied to clipboard!");
                            }
                          }}
                          className="border-black text-black hover:bg-gray-100"
                          data-testid={`button-share-certificate-${certificate.id}`}
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Unpaid Certificates */}
          {unpaidCertificates.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-black mb-4">
                Unpaid Certificates
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {unpaidCertificates.map((certificate) => (
                  <Card
                    key={certificate.id}
                    className="border-2 border-orange-400 hover:shadow-lg transition-shadow"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-orange-100 text-orange-800 font-medium">
                          Payment Pending
                        </Badge>
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                      </div>
                      <CardTitle className="text-lg text-black">
                        {certificate.courseTitle}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-premcq-gray-600">Score:</span>
                        <span className="font-semibold">
                          {certificate.score}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-premcq-gray-600">Expired:</span>
                        <span className="font-semibold text-red-600">
                          {new Date(certificate.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            window.open(
                              `/certificates/${certificate.certificateId}`,
                              "_blank"
                            )
                          }
                          className="flex-1"
                          data-testid={`button-view-unpaid-certificate-${certificate.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-premcq-black text-white hover:bg-premcq-gray-800"
                          data-testid={`button-renew-certificate-${certificate.id}`}
                        >
                          Renew - ₹199
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Exam History & Improvement Tracking */}
          {examAttempts.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-black flex items-center gap-2">
                  <BarChart3 className="w-6 h-6" />
                  Your Exam History & Progress
                </h2>
              </div>

              {/* Group exam attempts by course */}
              {(() => {
                const examsByCourse = examAttempts.reduce((acc: Record<number, EnrichedExamAttempt[]>, attempt) => {
                  if (!acc[attempt.courseId]) {
                    acc[attempt.courseId] = [];
                  }
                  acc[attempt.courseId].push(attempt);
                  return acc;
                }, {} as Record<number, EnrichedExamAttempt[]>);

                return Object.entries(examsByCourse).map(([courseId, attempts]) => {
                  const sortedAttempts = attempts.sort((a, b) => 
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                  );
                  
                  const latestAttempt = sortedAttempts[sortedAttempts.length - 1];
                  
                  // Only include paid attempts in calculations and graph
                  const paidAttempts = sortedAttempts.filter(attempt => (attempt as any).resultPaymentStatus === "paid");
                  const hasMultiplePaidAttempts = paidAttempts.length > 1;
                  const bestScore = paidAttempts.length > 0 ? Math.max(...paidAttempts.map(a => a.score)) : null;
                  const scoreImprovement = hasMultiplePaidAttempts 
                    ? paidAttempts[paidAttempts.length - 1].score - paidAttempts[0].score 
                    : 0;

                  // Prepare data for graph
                  const graphData = paidAttempts.map((attempt, index) => ({
                    attempt: `Attempt ${index + 1}`,
                    score: attempt.score,
                    date: new Date(attempt.createdAt).toLocaleDateString(),
                  }));

                  return (
                    <Card key={courseId} className="mb-6 border-2 border-black" data-testid={`card-exam-history-${courseId}`}>
                      <CardHeader className="bg-gradient-to-r from-gray-50 to-white">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-[200px]">
                            <CardTitle className="text-xl text-black mb-2 flex items-center gap-2">
                              <BookOpen className="w-5 h-5" />
                              <span data-testid={`text-course-title-${courseId}`}>{latestAttempt.courseTitle}</span>
                            </CardTitle>
                            <div className="flex gap-4 flex-wrap">
                              <div className="text-sm text-gray-600">
                                Total Attempts: <span className="font-semibold text-black" data-testid={`text-total-attempts-${courseId}`}>{sortedAttempts.length}</span>
                              </div>
                              {bestScore !== null && (
                                <div className="text-sm text-gray-600">
                                  Best Score: <span className="font-semibold text-black" data-testid={`text-best-score-${courseId}`}>{bestScore}%</span>
                                </div>
                              )}
                              {hasMultiplePaidAttempts && (
                                <div className="text-sm text-gray-600">
                                  Improvement: 
                                  <span 
                                    className={`font-semibold ml-1 ${scoreImprovement > 0 ? 'text-green-600' : scoreImprovement < 0 ? 'text-red-600' : 'text-gray-600'}`}
                                    data-testid={`text-improvement-${courseId}`}
                                  >
                                    {scoreImprovement > 0 ? '+' : ''}{scoreImprovement}%
                                  </span>
                                </div>
                              )}
                              {paidAttempts.length === 0 && (
                                <div className="text-sm text-gray-600">
                                  <span className="font-semibold text-orange-600">Pay ₹29 to unlock results</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <Link href={`/courses/${courseId}`}>
                            <Button 
                              className="bg-black text-white hover:bg-gray-800"
                              data-testid={`button-retake-exam-${courseId}`}
                            >
                              <RefreshCcw className="w-4 h-4 mr-2" />
                              Retake Exam
                            </Button>
                          </Link>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Exam Attempts List */}
                          <div>
                            <h4 className="font-semibold text-black mb-4">Recent Attempts</h4>
                            <div className="space-y-3">
                              {sortedAttempts.slice(-5).reverse().map((attempt, index) => {
                                const isPaid = (attempt as any).resultPaymentStatus === "paid";
                                return (
                                  <div 
                                    key={attempt.id} 
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200"
                                    data-testid={`card-exam-attempt-${attempt.id}`}
                                  >
                                    {isPaid ? (
                                      <>
                                        <div className="flex items-center gap-3">
                                          {attempt.passed ? (
                                            <CheckCircle className="w-5 h-5 text-green-600" data-testid={`icon-passed-${attempt.id}`} />
                                          ) : (
                                            <XCircle className="w-5 h-5 text-red-600" data-testid={`icon-failed-${attempt.id}`} />
                                          )}
                                          <div>
                                            <div className="font-semibold text-black" data-testid={`text-score-${attempt.id}`}>
                                              {attempt.score}%
                                            </div>
                                            <div className="text-xs text-gray-600" data-testid={`text-date-${attempt.id}`}>
                                              {new Date(attempt.createdAt).toLocaleDateString()}
                                            </div>
                                          </div>
                                        </div>
                                        <Badge 
                                          variant={attempt.passed ? "default" : "secondary"}
                                          className={attempt.passed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                                          data-testid={`badge-status-${attempt.id}`}
                                        >
                                          {attempt.passed ? "Passed" : "Failed"}
                                        </Badge>
                                      </>
                                    ) : (
                                      <>
                                        <div className="flex items-center gap-3">
                                          <Lock className="w-5 h-5 text-gray-400" data-testid={`icon-locked-${attempt.id}`} />
                                          <div>
                                            <div className="font-semibold text-gray-600" data-testid={`text-locked-${attempt.id}`}>
                                              Results Locked
                                            </div>
                                            <div className="text-xs text-gray-500" data-testid={`text-date-${attempt.id}`}>
                                              {new Date(attempt.createdAt).toLocaleDateString()}
                                            </div>
                                          </div>
                                        </div>
                                        <Button
                                          size="sm"
                                          className="bg-black text-white hover:bg-gray-800"
                                          data-testid={`button-pay-${attempt.id}`}
                                          onClick={() => {
                                            setSelectedAttempt({ id: attempt.id, courseTitle: attempt.courseTitle });
                                            setPaymentModalOpen(true);
                                          }}
                                        >
                                          Pay ₹29
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Progress Graph */}
                          {hasMultiplePaidAttempts && (
                            <div>
                              <h4 className="font-semibold text-black mb-4">Score Progression</h4>
                              <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={graphData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="attempt" tick={{fontSize: 12}} />
                                  <YAxis domain={[0, 100]} tick={{fontSize: 12}} />
                                  <Tooltip />
                                  <Line 
                                    type="monotone" 
                                    dataKey="score" 
                                    stroke="#000000" 
                                    strokeWidth={2}
                                    dot={{ fill: '#000000', r: 4 }}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                              <div className="mt-4 text-center">
                                <p className="text-sm text-gray-600">
                                  {scoreImprovement > 0 && (
                                    <span className="text-green-600 font-semibold">
                                      📈 Great progress! You've improved by {scoreImprovement}%
                                    </span>
                                  )}
                                  {scoreImprovement === 0 && (
                                    <span className="text-gray-600">
                                      Keep practicing to improve your score!
                                    </span>
                                  )}
                                  {scoreImprovement < 0 && (
                                    <span className="text-orange-600">
                                      Don't give up! Retake to improve your score.
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Message when no paid attempts or only one */}
                          {paidAttempts.length < 2 && (
                            <div className="flex items-center justify-center bg-gray-50 rounded-md border-2 border-dashed border-gray-300 p-8">
                              <div className="text-center">
                                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                <h4 className="font-semibold text-black mb-2">Track Your Progress</h4>
                                <p className="text-sm text-gray-600 mb-4">
                                  {paidAttempts.length === 0 
                                    ? "Pay ₹29 to unlock your results and start tracking progress"
                                    : "Retake this exam to see your improvement over time"}
                                </p>
                                <Link href={`/courses/${courseId}`}>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="border-black text-black hover:bg-black hover:text-white"
                                    data-testid={`button-retake-first-attempt-${courseId}`}
                                  >
                                    Retake Now
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                });
              })()}
            </div>
          )}

          {/* AI Interviews Section - Coming Soon */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-black mb-6">AI Interviews</h2>
            <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
              <CardContent className="p-12 text-center">
                <Brain className="w-20 h-20 text-gray-400 mx-auto mb-4 opacity-50" />
                <h3 className="text-2xl font-bold text-black mb-3">
                  Coming Soon
                </h3>
                <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                  AI-powered interview platform is under development. Soon you'll be able to practice technical interviews with instant AI feedback and scoring.
                </p>
                <Badge variant="secondary" className="mt-6 text-base px-6 py-2 bg-black text-white">
                  Feature in Development
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Empty State */}
          {certificates.length === 0 && (
            <Card className="border-2 border-black">
              <CardContent className="text-center py-12">
                <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-black mb-2">
                  No Certificates Yet
                </h2>
                <p className="text-gray-600 mb-6">
                  You haven't taken any certification exams yet. Start your
                  journey today!
                </p>
                <Link href="/">
                  <Button className="bg-black text-white hover:bg-gray-800">
                    Browse Courses
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Footer />

      {/* Payment Modal */}
      {selectedAttempt && (
        <PaymentModal
          open={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedAttempt(null);
          }}
          attemptId={selectedAttempt.id}
          courseTitle={selectedAttempt.courseTitle}
        />
      )}
    </div>
  );
}
