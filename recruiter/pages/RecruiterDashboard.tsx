import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRecruiterAuth } from '../auth/RecruiterAuthProvider';
import { apiRequest } from '@/lib/queryClient';
import RecruiterLayout from '../components/RecruiterLayout';
import InterviewEvidenceNotice from '../components/InterviewEvidenceNotice';
import { Link, useLocation } from 'wouter';
import {
  Users,
  Search,
  Eye,
  Download,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  History
} from 'lucide-react';

interface DashboardData {
  profileViews: number;
  cvDownloads: number;
  interviewAccess: number;
  totalCreditsUsed: number;
  recentActivity: Array<{
    id: number;
    type: string;
    userName: string;
    creditsUsed: string;
    createdAt: string;
  }>;
  kycStatus: string;
  creditsBalance: string;
}

export default function RecruiterDashboard() {
  const { recruiter } = useRecruiterAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoadError(false);
      const response = await apiRequest('GET', '/api/recruiter/dashboard');
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const getKycStatusComponent = () => {
    if (!recruiter) return null;

    switch (recruiter.kycStatus) {
      case 'pending':
        return (
          <Card className="border-l-4 border-slate-500 bg-gradient-to-r from-slate-50 to-slate-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="bg-slate-100 p-3 rounded-full">
                  <Clock className="h-8 w-8 text-slate-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800 text-lg">Verification In Progress</h3>
                  <p className="text-slate-700 text-sm mt-1">
                    Complete your company profile to unlock candidate search and protected evidence.
                  </p>
                  <Link href="/recruiter/onboarding"><Button className="mt-3 bg-slate-600 hover:bg-slate-700 text-white" size="sm">Complete setup</Button></Link>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 'under_review':
        return (
          <Card className="border-l-4 border-slate-500 bg-gradient-to-r from-slate-50 to-slate-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="bg-slate-100 p-3 rounded-full">
                  <AlertCircle className="h-8 w-8 text-slate-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800 text-lg">Under Review</h3>
                  <p className="text-slate-700 text-sm mt-1">
                    Our team is reviewing your documents. You'll be notified within 24-48 hours.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 'rejected':
        return (
          <Card className="border-l-4 border-red-500 bg-gradient-to-r from-red-50 to-slate-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="bg-red-100 p-3 rounded-full">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-red-800 text-lg">Verification Failed</h3>
                  <p className="text-red-700 text-sm mt-1">
                    Please resubmit your documents or contact our support team.
                  </p>
                  <Link href="/recruiter/settings"><Button className="mt-3 bg-red-600 hover:bg-red-700 text-white" size="sm">Review verification details</Button></Link>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 'approved':
        return (
          <Card className="border-l-4 border-slate-500 bg-gradient-to-r from-slate-50 to-slate-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="bg-slate-100 p-3 rounded-full">
                  <CheckCircle className="h-8 w-8 text-slate-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800 text-lg">✓ Fully Verified</h3>
                  <p className="text-slate-700 text-sm mt-1">
                    Your company is verified. You now have access to candidate search and evidence controls.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <RecruiterLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-slate-600 border-t-transparent rounded-full" />
        </div>
      </RecruiterLayout>
    );
  }

  return (
    <RecruiterLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {recruiter?.firstName}!
          </h1>
          <p className="text-gray-600 mt-2">
            Here's what's happening with your recruitment activities.
          </p>
        </div>

        {loadError && (
          <Card className="border-slate-200 bg-slate-50">
            <CardContent className="flex flex-col gap-3 p-4 text-sm text-slate-900 sm:flex-row sm:items-center sm:justify-between">
              <span>We couldn't load the latest recruiter activity.</span>
              <Button size="sm" variant="outline" onClick={fetchDashboardData}>Retry</Button>
            </CardContent>
          </Card>
        )}

        {/* KYC Status */}
        {recruiter?.kycStatus !== 'approved' && (
          <div className="mb-6">
            {getKycStatusComponent()}
          </div>
        )}

        <InterviewEvidenceNotice compact />

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profile Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData?.profileViews || 0}</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CV Downloads</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData?.cvDownloads || 0}</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Historical interview access</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData?.interviewAccess || 0}</div>
              <p className="text-xs text-muted-foreground">Retired prototype records only</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credits Balance</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recruiter?.creditsBalance || '0'}</div>
              <Link href="/recruiter/wallet">
                <Button size="sm" className="mt-2" variant="outline">
                  Buy Credits
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Search className="h-5 w-5" />
                <span>Search Candidates</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Find the perfect candidates using our advanced search filters.
              </p>
              <Link href="/recruiter/search">
                <Button className="w-full bg-slate-600 hover:bg-slate-700">
                  Start Searching
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Recently Viewed</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Access profiles you've recently viewed or downloaded.
              </p>
              <Link href="/recruiter/analytics"><Button variant="outline" className="w-full">View activity</Button></Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Analytics</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Track your recruitment metrics and performance.
              </p>
              <Link href="/recruiter/analytics">
                <Button variant="outline" className="w-full">
                  View Analytics
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData?.recentActivity && dashboardData.recentActivity.length > 0 ? (
              <div className="space-y-4">
                {dashboardData.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-2 w-2 bg-slate-600 rounded-full" />
                      <div>
                        <p className="font-medium">
                          {activity.type === 'profile_view' && 'Viewed profile of '}
                          {activity.type === 'cv_download' && 'Downloaded CV of '}
                          {activity.type === 'interview_access' && 'Historical prototype interview access for '}
                          {activity.userName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(activity.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={activity.type === 'interview_access' ? 'border-slate-300 bg-slate-50 text-slate-600' : ''}>
                      {activity.type === 'interview_access' ? 'Historical · ' : ''}{activity.creditsUsed} credits
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No recent activity. Start searching for candidates to see your activity here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </RecruiterLayout>
  );
}
