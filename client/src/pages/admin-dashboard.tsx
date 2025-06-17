import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  MousePointer, 
  Award,
  CheckCircle,
  XCircle,
  Eye,
  Download,
  BarChart3,
  Shield,
  LogOut
} from "lucide-react";

interface Partner {
  id: number;
  name: string;
  email: string;
  isApproved: boolean;
  totalEarnings: number;
  pendingEarnings: number;
  referralCode: string;
  clickCount: number;
  conversionCount: number;
  conversionRate: number;
  createdAt: string;
}

interface Analytics {
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  totalPartners: number;
  approvedPartners: number;
  pendingPartners: number;
  topPerformingPartners: Partner[];
  recentActivity: any[];
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  // Check admin authentication
  const adminToken = localStorage.getItem("adminToken");
  if (!adminToken) {
    setLocation("/admin/login");
    return null;
  }

  // Fetch analytics data
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/admin/analytics"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/analytics");
      return response.json() as Promise<Analytics>;
    },
  });

  // Fetch partners data
  const { data: partners, isLoading: partnersLoading } = useQuery({
    queryKey: ["/api/admin/partners"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/partners");
      return response.json() as Promise<Partner[]>;
    },
  });

  // Fetch withdrawals data
  const { data: withdrawals, isLoading: withdrawalsLoading } = useQuery({
    queryKey: ["/api/admin/withdrawals"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/withdrawals");
      return response.json();
    },
  });

  // Partner approval mutation
  const approvePartnerMutation = useMutation({
    mutationFn: async ({ partnerId, approved }: { partnerId: number; approved: boolean }) => {
      const response = await apiRequest("POST", `/api/admin/partners/${partnerId}/approve`, { approved });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      toast({
        title: "Partner Status Updated",
        description: "Partner approval status has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update partner status",
        variant: "destructive",
      });
    },
  });

  // Withdrawal processing mutation
  const processWithdrawalMutation = useMutation({
    mutationFn: async ({ withdrawalId, status }: { withdrawalId: number; status: string }) => {
      const response = await apiRequest("POST", `/api/admin/withdrawals/${withdrawalId}/process`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] });
      toast({
        title: "Withdrawal Processed",
        description: "Withdrawal request has been processed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process withdrawal",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setLocation("/admin/login");
  };

  if (analyticsLoading || partnersLoading || withdrawalsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Octamy Platform Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <Eye className="w-4 h-4 mr-2" />
                  View Site
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="partners">Partners</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Partners</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.totalPartners || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {analytics?.approvedPartners || 0} approved, {analytics?.pendingPartners || 0} pending
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
                  <MousePointer className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.totalClicks || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {analytics?.totalConversions || 0} conversions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{analytics?.totalRevenue || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    From partner referrals
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics?.totalClicks ? ((analytics.totalConversions / analytics.totalClicks) * 100).toFixed(1) : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Overall platform rate
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Top Performing Partners */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Partners</CardTitle>
                <CardDescription>Partners with highest earnings and conversion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead>Clicks</TableHead>
                      <TableHead>Conversions</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Earnings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics?.topPerformingPartners?.map((partner) => (
                      <TableRow key={partner.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{partner.name}</div>
                            <div className="text-sm text-gray-500">{partner.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{partner.clickCount}</TableCell>
                        <TableCell>{partner.conversionCount}</TableCell>
                        <TableCell>{partner.conversionRate.toFixed(1)}%</TableCell>
                        <TableCell>₹{partner.totalEarnings}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Partners Tab */}
          <TabsContent value="partners" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Partner Management</CardTitle>
                <CardDescription>Manage partner approvals and view performance</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Referral Code</TableHead>
                      <TableHead>Clicks</TableHead>
                      <TableHead>Conversions</TableHead>
                      <TableHead>Earnings</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partners?.map((partner) => (
                      <TableRow key={partner.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{partner.name}</div>
                            <div className="text-sm text-gray-500">{partner.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={partner.isApproved ? "default" : "secondary"}>
                            {partner.isApproved ? "Approved" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            {partner.referralCode}
                          </code>
                        </TableCell>
                        <TableCell>{partner.clickCount}</TableCell>
                        <TableCell>{partner.conversionCount}</TableCell>
                        <TableCell>₹{partner.totalEarnings}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            {!partner.isApproved && (
                              <Button
                                size="sm"
                                onClick={() => approvePartnerMutation.mutate({ partnerId: partner.id, approved: true })}
                                disabled={approvePartnerMutation.isPending}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                            )}
                            {partner.isApproved && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => approvePartnerMutation.mutate({ partnerId: partner.id, approved: false })}
                                disabled={approvePartnerMutation.isPending}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Suspend
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Click Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Total Clicks</span>
                      <span className="font-semibold">{analytics?.totalClicks || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Conversions</span>
                      <span className="font-semibold">{analytics?.totalConversions || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Conversion Rate</span>
                      <span className="font-semibold">
                        {analytics?.totalClicks ? ((analytics.totalConversions / analytics.totalClicks) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="w-5 h-5 mr-2" />
                    Revenue Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Total Revenue</span>
                      <span className="font-semibold">₹{analytics?.totalRevenue || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Partner Commission (10%)</span>
                      <span className="font-semibold">₹{((analytics?.totalRevenue || 0) * 0.1).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Platform Revenue (90%)</span>
                      <span className="font-semibold">₹{((analytics?.totalRevenue || 0) * 0.9).toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Export Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Export Reports</CardTitle>
                <CardDescription>Download analytics reports for external analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-4">
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Export Partners CSV
                  </Button>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Export Analytics CSV
                  </Button>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Export Revenue Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Withdrawal Requests</CardTitle>
                <CardDescription>Manage partner withdrawal requests and payments</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals?.map((withdrawal: any) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{withdrawal.seller?.name}</div>
                            <div className="text-sm text-gray-500">{withdrawal.seller?.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>₹{withdrawal.amount}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {withdrawal.method === 'upi' ? 'UPI' : 'Bank Transfer'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            withdrawal.status === 'approved' ? 'default' : 
                            withdrawal.status === 'rejected' ? 'destructive' : 'secondary'
                          }>
                            {withdrawal.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(withdrawal.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {withdrawal.status === 'pending' && (
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => processWithdrawalMutation.mutate({ withdrawalId: withdrawal.id, status: 'approved' })}
                                disabled={processWithdrawalMutation.isPending}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => processWithdrawalMutation.mutate({ withdrawalId: withdrawal.id, status: 'rejected' })}
                                disabled={processWithdrawalMutation.isPending}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}