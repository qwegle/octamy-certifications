import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth.tsx";
import { Link, useLocation } from "wouter";
import Header from "@/components/header";
import Footer from "@/components/footer";
import DashboardLayout from "@/components/dashboard-layout";
import {
  Download,
  Eye,
  Calendar,
  Trophy,
  Award,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Edit,
  ShieldCheck,
} from "lucide-react";
import type { Certificate } from "@shared/schema";
import DashboardAnalytics from "@/components/dashboard-analytics";
import { useEffect } from "react";

export default function Dashboard() {
  const { user, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [isLoading, user, setLocation]);

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

  // Fetch user's profile to get completeness
  const { data: userProfile } = useQuery<{ profileCompleteness?: number }>({
    queryKey: ["/api/user/profile"],
    enabled: !!user && !!token,
  });

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
      <DashboardLayout role="learner" title="Login required">
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-octamy-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-octamy-black mb-2">
              Login Required
            </h2>
            <p className="text-octamy-gray-600 mb-6">
              Please log in to view your certificate dashboard.
            </p>
            <Link href="/login">
              <Button className="bg-octamy-black text-white hover:bg-octamy-gray-800">
                Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </DashboardLayout>
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

  // Money saved: compute from real list price vs amount paid (fallback 0).
  const moneySaved = certificates.reduce((total, cert: any) => {
    if (!cert.isPaid) return total;
    const list = Number(cert.listPrice ?? cert.coursePrice ?? 0);
    const paid = Number(cert.amountPaid ?? 0);
    return total + Math.max(0, list - paid);
  }, 0);

  // Calculate average score
  const averageScore =
    certificates.length > 0
      ? Math.round(
          certificates.reduce((acc, cert) => acc + cert.score, 0) /
            certificates.length
        )
      : 0;

  return (
    <DashboardLayout role="learner" title={`Welcome back, ${user.name}!`} description="Manage your certificates and track your progress" actions={(
      <Link href="/profile-edit">
        <Button variant="outline" className="border-black text-black hover:bg-black hover:text-white">
          <Edit className="w-4 h-4 mr-2" />
          {userProfile?.profileCompleteness === 100 ? "Edit Profile" : "Complete Profile"}
        </Button>
      </Link>
    )}>
      {/* Key Performance Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-6 mb-8">
          <Card className="border-2 border-black">
            <CardContent className="p-4 sm:p-6 text-center bg-gradient-to-br from-gray-50 to-white">
              <Award className="w-8 h-8 sm:w-10 sm:h-10 text-black mx-auto mb-3" />
              <div className="text-2xl sm:text-3xl font-bold text-black">
                {certificates.length}
              </div>
              <div className="text-sm text-gray-600 font-medium">
                Total Certificates
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-black">
            <CardContent className="p-4 sm:p-6 text-center bg-gradient-to-br from-gray-50 to-white">
              <ShieldCheck className="w-8 h-8 sm:w-10 sm:h-10 text-black mx-auto mb-3" />
              <div className="text-2xl sm:text-3xl font-bold text-black">
                {activeCertificates.length}
              </div>
              <div className="text-sm text-gray-600 font-medium">
                Verified Credentials
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-black">
            <CardContent className="p-4 sm:p-6 text-center bg-gradient-to-br from-gray-50 to-white">
              <DollarSign className="w-8 h-8 sm:w-10 sm:h-10 text-black mx-auto mb-3" />
              <div className="text-2xl sm:text-3xl font-bold text-black">₹{moneySaved}</div>
              <div className="text-sm text-gray-600 font-medium">
                Money Saved
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-black">
            <CardContent className="p-4 sm:p-6 text-center bg-gradient-to-br from-gray-50 to-white">
              <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 text-black mx-auto mb-3" />
              <div className="text-2xl sm:text-3xl font-bold text-black">
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

          {certificatesLoading && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Loading certificates">
              {[1, 2, 3].map((item) => <div key={item} className="h-52 animate-pulse rounded-xl bg-slate-200/70" />)}
            </div>
          )}

          {certificatesError && (
            <Card className="border-rose-200 bg-rose-50"><CardContent className="p-5 text-sm text-rose-800">We couldn't load your credentials. Refresh the page to try again.</CardContent></Card>
          )}

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
                        >
                          🔗
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {expiredCertificates.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-black mb-4">Expired credentials</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {expiredCertificates.map((certificate) => (
                  <Card key={certificate.id} className="border-2 border-slate-300 bg-slate-50">
                    <CardHeader className="pb-3">
                      <Badge variant="outline" className="w-fit bg-white text-slate-700">Expired</Badge>
                      <CardTitle className="text-lg text-black">{certificate.courseTitle}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-slate-600">Score: <span className="font-semibold text-slate-900">{certificate.score}%</span></p>
                      <p className="text-sm text-slate-600">Expired {new Date(certificate.expiresAt).toLocaleDateString()}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setLocation(`/certificate/${certificate.certificateId}`)}>View record</Button>
                        <Button size="sm" onClick={() => setLocation('/exams')} className="bg-slate-900 text-white">Retake exam</Button>
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
                        <span className="text-octamy-gray-600">Score:</span>
                        <span className="font-semibold">
                          {certificate.score}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-octamy-gray-600">Status:</span>
                        <span className="font-semibold text-orange-700">Awaiting activation</span>
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
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-octamy-black text-white hover:bg-octamy-gray-800"
                          onClick={() => setLocation(`/payment/${certificate.certificateId}`)}
                        >
                          Activate
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <Card className="mb-8 border-2 border-slate-900 bg-slate-950 text-white">
            <CardContent className="p-8 flex flex-col md:flex-row md:items-center gap-6">
              <ShieldCheck className="w-12 h-12 text-sky-300 flex-shrink-0" />
              <div className="flex-1">
                <h2 className="text-2xl font-bold">Your Skill Evidence Passport</h2>
                <p className="mt-2 text-slate-300">
                  Every paid credential is backed by a scored assessment and a live verification record you can share with employers.
                </p>
              </div>
              <div className="flex gap-3">
                <Link href="/exams"><Button className="bg-white text-slate-950 hover:bg-slate-100">Add evidence</Button></Link>
                <Link href="/verify"><Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white hover:text-slate-950">Verify a credential</Button></Link>
              </div>
            </CardContent>
          </Card>

          {/* Empty State */}
          {!certificatesLoading && !certificatesError && certificates.length === 0 && (
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
                <Link href="/exams">
                  <Button className="bg-black text-white hover:bg-gray-800">
                    Browse Courses
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
    </DashboardLayout>
  );
}
