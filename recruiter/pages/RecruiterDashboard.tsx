import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRecruiterAuth } from '../auth/RecruiterAuthProvider';
import { apiRequest } from '@/lib/queryClient';
import RecruiterLayout from '../components/RecruiterLayout';
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
  Activity
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

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await apiRequest('GET', '/api/recruiter/dashboard');
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getKycStatusComponent = () => {
    if (!recruiter) return null;

    switch (recruiter.kycStatus) {
      case 'pending':
        return (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div>
                  <h3 className="font-semibold text-yellow-800">KYC Verification Pending</h3>
                  <p className="text-yellow-700 text-sm">
                    Complete your profile setup to start accessing candidate profiles.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 'under_review':
        return (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-blue-800">KYC Under Review</h3>
                  <p className="text-blue-700 text-sm">
                    Your documents are being reviewed. This usually takes 1-2 business days.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 'rejected':
        return (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-8 w-8 text-red-600" />
                <div>
                  <h3 className="font-semibold text-red-800">KYC Verification Failed</h3>
                  <p className="text-red-700 text-sm">
                    Please resubmit your documents or contact support for assistance.
                  </p>
                  <Button className="mt-2" size="sm">
                    Resubmit Documents
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 'approved':
        return (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-800">KYC Verified</h3>
                  <p className="text-green-700 text-sm">
                    Your account is verified. You can now access all candidate profiles.
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
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
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

        {/* KYC Status */}
        {recruiter?.kycStatus !== 'approved' && (
          <div className="mb-6">
            {getKycStatusComponent()}
          </div>
        )}

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
              <CardTitle className="text-sm font-medium">Interview Access</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData?.interviewAccess || 0}</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credits Balance</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recruiter?.creditsBalance || '0'}</div>
              <Button size="sm" className="mt-2" variant="outline">
                Buy Credits
              </Button>
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
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                Start Searching
              </Button>
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
              <Button variant="outline" className="w-full">
                View History
              </Button>
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
              <Button variant="outline" className="w-full">
                View Analytics
              </Button>
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
                      <div className="h-2 w-2 bg-blue-600 rounded-full" />
                      <div>
                        <p className="font-medium">
                          {activity.type === 'profile_view' && 'Viewed profile of '}
                          {activity.type === 'cv_download' && 'Downloaded CV of '}
                          {activity.type === 'interview_access' && 'Accessed interview data of '}
                          {activity.userName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(activity.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {activity.creditsUsed} credits
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