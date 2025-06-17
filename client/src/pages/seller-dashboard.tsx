import React, { useState, useEffect } from "react";
import { useSellerAuth } from "@/lib/sellerAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  CreditCard, 
  Eye,
  Copy,
  Download,
  LogOut,
  Share2,
  ExternalLink,
  CheckCircle,
  X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DashboardData {
  seller: {
    id: number;
    name: string;
    email: string;
    isApproved: boolean;
    totalEarnings: string;
    pendingEarnings: string;
    commissionRate: string;
  };
  sales: Array<{
    id: number;
    amount: string;
    commission: string;
    status: string;
    referralCode: string;
    createdAt: string;
  }>;
  withdrawals: Array<{
    id: number;
    amount: string;
    status: string;
    createdAt: string;
  }>;
  analytics: {
    totalSales: number;
    totalCommission: number;
    pendingWithdrawals: number;
  };
  clickAnalytics?: {
    totalClicks: number;
    totalConversions: number;
    conversionRate: number;
    courseWiseAnalytics: Array<{
      courseId: number;
      courseTitle: string;
      clicks: number;
      conversions: number;
      conversionRate: number;
      latestClick: Date | null;
    }>;
  };
}

export default function SellerDashboard() {
  const { seller, logout, token, isLoading: authLoading } = useSellerAuth();
  const { toast } = useToast();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareableItems, setShareableItems] = useState<any>(null);
  const [generatedUrls, setGeneratedUrls] = useState<{[key: string]: string}>({});
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [withdrawalData, setWithdrawalData] = useState({
    amount: "",
    upiId: "",
    bankAccountNumber: "",
    bankIFSC: "",
    bankName: "",
    accountHolderName: ""
  });

  useEffect(() => {
    // Wait for auth to finish loading before making decisions
    if (authLoading) {
      return;
    }
    
    // If no token after loading is complete, redirect to login
    if (!token) {
      window.location.href = '/seller-auth';
      return;
    }
    
    // If we have a token, fetch dashboard data
    fetchDashboardData();
    fetchShareableItems();
  }, [token, authLoading]);

  const fetchDashboardData = async () => {
    if (!token) {
      return;
    }

    try {
      const response = await fetch("/api/sellers/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else if (response.status === 401 || response.status === 403) {
        toast({
          title: "Session Expired", 
          description: "Redirecting to login...",
          variant: "destructive",
        });
        logout();
        setTimeout(() => {
          window.location.href = '/seller-auth';
        }, 1000);
      } else {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        toast({
          title: "Error",
          description: errorData.message || "Failed to fetch dashboard data",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
      toast({
        title: "Connection Error",
        description: "Please check your connection and try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShareableItems = async () => {
    try {
      const response = await fetch("/api/sellers/shareable-items", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setShareableItems(data);
      } else if (response.status === 401 || response.status === 403) {
        toast({
          title: "Authentication Error",
          description: "Please log in again to continue",
          variant: "destructive",
        });
        logout();
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch shareable items",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching shareable items:", error);
      toast({
        title: "Error",
        description: "Failed to fetch shareable items",
        variant: "destructive",
      });
    }
  };

  const generateReferralUrl = async (type: string, itemId: number) => {
    try {
      const response = await fetch("/api/sellers/generate-referral-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type, itemId }),
      });

      if (response.ok) {
        const data = await response.json();
        const urlKey = `${type}_${itemId}`;
        setGeneratedUrls(prev => ({
          ...prev,
          [urlKey]: data.referralUrl
        }));
        toast({
          title: "Success",
          description: "Referral URL generated successfully",
        });
      } else if (response.status === 401 || response.status === 403) {
        toast({
          title: "Authentication Error",
          description: "Please log in again to continue",
          variant: "destructive",
        });
        logout();
      } else {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        toast({
          title: "Error",
          description: errorData.message || "Failed to generate referral URL",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error generating referral URL:", error);
      toast({
        title: "Error",
        description: "Failed to generate referral URL",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Referral URL copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy URL",
        variant: "destructive",
      });
    }
  };

  const copyReferralLink = (courseId: number) => {
    const referralLink = `${window.location.origin}/course/${courseId}?ref=${seller?.email}`;
    navigator.clipboard.writeText(referralLink);
    toast({
      title: "Copied!",
      description: "Referral link copied to clipboard",
    });
  };

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch("/api/sellers/withdrawals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(withdrawalData),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Withdrawal request submitted successfully",
        });
        setShowWithdrawalForm(false);
        setWithdrawalData({
          amount: "",
          upiId: "",
          bankAccountNumber: "",
          bankIFSC: "",
          bankName: "",
          accountHolderName: ""
        });
        fetchDashboardData();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit withdrawal request",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Failed to load dashboard data</p>
          <Button onClick={fetchDashboardData} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-black text-white p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">OCTAMY</h1>
            <p className="text-gray-300">Partner Dashboard</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="font-medium">{dashboardData.seller.name}</p>
              <Badge 
                variant={dashboardData.seller.isApproved ? "default" : "destructive"}
                className={dashboardData.seller.isApproved ? "bg-green-600" : "bg-red-600"}
              >
                {dashboardData.seller.isApproved ? "Approved" : "Pending Approval"}
              </Badge>
            </div>
            <Button 
              onClick={logout}
              variant="outline"
              className="text-white border-white hover:bg-white hover:text-black"
            >
              <LogOut size={16} className="mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Approval Status Alert */}
        {!dashboardData.seller.isApproved && (
          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Account Pending Approval:</strong> Your partner account is under review. You'll be able to start earning commissions once approved by our team.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-2 border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-black" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                  <p className="text-2xl font-bold text-black">₹{dashboardData.seller.totalEarnings}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-black" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Earnings</p>
                  <p className="text-2xl font-bold text-black">₹{dashboardData.seller.pendingEarnings}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-black" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Sales</p>
                  <p className="text-2xl font-bold text-black">{dashboardData.analytics.totalSales}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center">
                <CreditCard className="h-8 w-8 text-black" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Commission Rate</p>
                  <p className="text-2xl font-bold text-black">{dashboardData.seller.commissionRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="border-2 border-black">
            <CardHeader className="bg-black text-white">
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <Button 
                onClick={() => setShowShareModal(true)}
                className="w-full bg-black text-white hover:bg-gray-800"
                disabled={!dashboardData.seller.isApproved}
              >
                <Share2 size={16} className="mr-2" />
                Generate Sharing URLs
              </Button>
              
              <Button 
                onClick={() => setShowWithdrawalForm(true)}
                variant="outline"
                className="w-full border-2 border-black text-black hover:bg-black hover:text-white"
                disabled={!dashboardData.seller.isApproved || parseFloat(dashboardData.seller.pendingEarnings) === 0}
              >
                <Download size={16} className="mr-2" />
                Request Withdrawal
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 border-gray-200">
            <CardHeader>
              <CardTitle>Partner Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Share your referral link to earn 10% commission</li>
                <li>• Commissions are credited after successful course completion</li>
                <li>• Minimum withdrawal amount: ₹500</li>
                <li>• Withdrawals processed within 5-7 business days</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Click Analytics */}
        {dashboardData.clickAnalytics && (
          <Card className="border-2 border-gray-200 mb-8">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-black">Click Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold text-black">{dashboardData.clickAnalytics.totalClicks}</p>
                  <p className="text-sm text-gray-600">Total Clicks</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold text-black">{dashboardData.clickAnalytics.totalConversions}</p>
                  <p className="text-sm text-gray-600">Conversions</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold text-black">{dashboardData.clickAnalytics.conversionRate.toFixed(1)}%</p>
                  <p className="text-sm text-gray-600">Conversion Rate</p>
                </div>
              </div>
              
              {dashboardData.clickAnalytics.courseWiseAnalytics.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-black">Course Performance</h4>
                  {dashboardData.clickAnalytics.courseWiseAnalytics.map((course) => (
                    <div key={course.courseId} className="p-4 bg-white border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-medium text-black">{course.courseTitle}</h5>
                        <span className="text-lg font-bold text-black">{course.conversionRate.toFixed(1)}%</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm text-gray-600">
                        <span><strong>{course.clicks}</strong> clicks</span>
                        <span><strong>{course.conversions}</strong> conversions</span>
                        <span>Latest: {course.latestClick ? new Date(course.latestClick).toLocaleDateString() : 'No clicks yet'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Sales */}
        <Card className="border-2 border-gray-200 mb-8">
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData.sales.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Amount</th>
                      <th className="text-left p-3">Commission</th>
                      <th className="text-left p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.sales.map((sale) => (
                      <tr key={sale.id} className="border-b border-gray-100">
                        <td className="p-3">{new Date(sale.createdAt).toLocaleDateString()}</td>
                        <td className="p-3">₹{sale.amount}</td>
                        <td className="p-3">₹{sale.commission}</td>
                        <td className="p-3">
                          <Badge variant={sale.status === 'paid' ? 'default' : 'secondary'}>
                            {sale.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users size={48} className="mx-auto mb-4 opacity-50" />
                <p>No sales yet. Start sharing your referral link!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Withdrawal History */}
        <Card className="border-2 border-gray-200">
          <CardHeader>
            <CardTitle>Withdrawal History</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData.withdrawals.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Amount</th>
                      <th className="text-left p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.withdrawals.map((withdrawal) => (
                      <tr key={withdrawal.id} className="border-b border-gray-100">
                        <td className="p-3">{new Date(withdrawal.createdAt).toLocaleDateString()}</td>
                        <td className="p-3">₹{withdrawal.amount}</td>
                        <td className="p-3">
                          <Badge 
                            variant={
                              withdrawal.status === 'processed' ? 'default' :
                              withdrawal.status === 'approved' ? 'secondary' :
                              withdrawal.status === 'rejected' ? 'destructive' : 'outline'
                            }
                          >
                            {withdrawal.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CreditCard size={48} className="mx-auto mb-4 opacity-50" />
                <p>No withdrawal requests yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Partner Sharing Modal */}
      {showShareModal && shareableItems && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-black">Generate Partner Sharing URLs</h3>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowShareModal(false);
                  setGeneratedUrls({});
                  setSelectedItem(null);
                }}
                className="text-gray-500 hover:text-black"
              >
                <X size={20} />
              </Button>
            </div>

            <div className="space-y-6">
              {/* Courses */}
              <div>
                <h4 className="text-lg font-semibold text-black mb-4 flex items-center">
                  <ExternalLink size={20} className="mr-2" />
                  Professional Courses ({shareableItems.courses?.length || 0})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {shareableItems.courses?.map((course: any) => {
                    const urlKey = `course_${course.id}`;
                    const hasUrl = generatedUrls[urlKey];
                    
                    return (
                      <Card key={course.id} className="border border-gray-200 hover:border-black transition-colors">
                        <CardContent className="p-4">
                          <h5 className="font-medium text-black mb-2">{course.title}</h5>
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{course.description}</p>
                          
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-lg font-bold text-black">₹{course.price}</span>
                            <Badge variant="secondary" className="text-xs">
                              10% Commission
                            </Badge>
                          </div>

                          {hasUrl ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded p-2">
                                <span className="text-xs text-green-800 font-medium">Referral URL Generated</span>
                                <CheckCircle size={14} className="text-green-600" />
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  onClick={() => copyToClipboard(hasUrl)}
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 border-black text-black hover:bg-black hover:text-white"
                                >
                                  <Copy size={14} className="mr-1" />
                                  Copy URL
                                </Button>
                                <Button 
                                  onClick={() => generateReferralUrl('course', course.id)}
                                  size="sm"
                                  variant="ghost"
                                  className="text-gray-500 hover:text-black"
                                >
                                  <Share2 size={14} />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button 
                              onClick={() => generateReferralUrl('course', course.id)}
                              size="sm"
                              className="w-full bg-black text-white hover:bg-gray-800"
                            >
                              <Share2 size={14} className="mr-1" />
                              Generate Referral URL
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Virtual Internships */}
              <div>
                <h4 className="text-lg font-semibold text-black mb-4 flex items-center">
                  <ExternalLink size={20} className="mr-2" />
                  Virtual Internships ({shareableItems.internships?.length || 0})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {shareableItems.internships?.map((internship: any) => {
                    const urlKey = `internship_${internship.id}`;
                    const hasUrl = generatedUrls[urlKey];
                    
                    return (
                      <Card key={internship.id} className="border border-gray-200 hover:border-black transition-colors">
                        <CardContent className="p-4">
                          <h5 className="font-medium text-black mb-2">{internship.title}</h5>
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{internship.description}</p>
                          
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-lg font-bold text-black">₹{internship.price}</span>
                            <Badge variant="secondary" className="text-xs">
                              10% Commission
                            </Badge>
                          </div>

                          {hasUrl ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded p-2">
                                <span className="text-xs text-green-800 font-medium">Referral URL Generated</span>
                                <CheckCircle size={14} className="text-green-600" />
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  onClick={() => copyToClipboard(hasUrl)}
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 border-black text-black hover:bg-black hover:text-white"
                                >
                                  <Copy size={14} className="mr-1" />
                                  Copy URL
                                </Button>
                                <Button 
                                  onClick={() => generateReferralUrl('internship', internship.id)}
                                  size="sm"
                                  variant="ghost"
                                  className="text-gray-500 hover:text-black"
                                >
                                  <Share2 size={14} />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button 
                              onClick={() => generateReferralUrl('internship', internship.id)}
                              size="sm"
                              className="w-full bg-black text-white hover:bg-gray-800"
                            >
                              <Share2 size={14} className="mr-1" />
                              Generate Referral URL
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Business Certifications */}
              <div>
                <h4 className="text-lg font-semibold text-black mb-4 flex items-center">
                  <ExternalLink size={20} className="mr-2" />
                  Business Certifications ({shareableItems.businessCertifications?.length || 0})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {shareableItems.businessCertifications?.map((cert: any) => {
                    const urlKey = `business_${cert.id}`;
                    const hasUrl = generatedUrls[urlKey];
                    
                    return (
                      <Card key={cert.id} className="border border-gray-200 hover:border-black transition-colors">
                        <CardContent className="p-4">
                          <h5 className="font-medium text-black mb-2">{cert.title}</h5>
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{cert.description}</p>
                          
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-lg font-bold text-black">₹{cert.price}</span>
                            <Badge variant="secondary" className="text-xs">
                              10% Commission
                            </Badge>
                          </div>

                          {hasUrl ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded p-2">
                                <span className="text-xs text-green-800 font-medium">Referral URL Generated</span>
                                <CheckCircle size={14} className="text-green-600" />
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  onClick={() => copyToClipboard(hasUrl)}
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 border-black text-black hover:bg-black hover:text-white"
                                >
                                  <Copy size={14} className="mr-1" />
                                  Copy URL
                                </Button>
                                <Button 
                                  onClick={() => generateReferralUrl('business', cert.id)}
                                  size="sm"
                                  variant="ghost"
                                  className="text-gray-500 hover:text-black"
                                >
                                  <Share2 size={14} />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button 
                              onClick={() => generateReferralUrl('business', cert.id)}
                              size="sm"
                              className="w-full bg-black text-white hover:bg-gray-800"
                            >
                              <Share2 size={14} className="mr-1" />
                              Generate Referral URL
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>


            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Form Modal */}
      {showWithdrawalForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md border-2 border-black">
            <CardHeader className="bg-black text-white">
              <CardTitle>Withdrawal Request</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="amount">Amount (₹)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="500"
                    max={dashboardData.seller.pendingEarnings}
                    value={withdrawalData.amount}
                    onChange={(e) => setWithdrawalData({...withdrawalData, amount: e.target.value})}
                    className="border-2 border-gray-300 focus:border-black"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="upiId">UPI ID (Optional)</Label>
                  <Input
                    id="upiId"
                    type="text"
                    value={withdrawalData.upiId}
                    onChange={(e) => setWithdrawalData({...withdrawalData, upiId: e.target.value})}
                    className="border-2 border-gray-300 focus:border-black"
                    placeholder="example@upi"
                  />
                </div>

                <div className="border-t pt-4">
                  <Label className="text-sm font-medium">Bank Details (Alternative to UPI)</Label>
                  
                  <div className="mt-2 space-y-3">
                    <Input
                      placeholder="Account Holder Name"
                      value={withdrawalData.accountHolderName}
                      onChange={(e) => setWithdrawalData({...withdrawalData, accountHolderName: e.target.value})}
                      className="border-2 border-gray-300 focus:border-black"
                    />
                    
                    <Input
                      placeholder="Account Number"
                      value={withdrawalData.bankAccountNumber}
                      onChange={(e) => setWithdrawalData({...withdrawalData, bankAccountNumber: e.target.value})}
                      className="border-2 border-gray-300 focus:border-black"
                    />
                    
                    <Input
                      placeholder="IFSC Code"
                      value={withdrawalData.bankIFSC}
                      onChange={(e) => setWithdrawalData({...withdrawalData, bankIFSC: e.target.value})}
                      className="border-2 border-gray-300 focus:border-black"
                    />
                    
                    <Input
                      placeholder="Bank Name"
                      value={withdrawalData.bankName}
                      onChange={(e) => setWithdrawalData({...withdrawalData, bankName: e.target.value})}
                      className="border-2 border-gray-300 focus:border-black"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button 
                    type="button"
                    onClick={() => setShowWithdrawalForm(false)}
                    variant="outline"
                    className="flex-1 border-2 border-gray-300"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    className="flex-1 bg-black text-white hover:bg-gray-800"
                  >
                    Submit Request
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}