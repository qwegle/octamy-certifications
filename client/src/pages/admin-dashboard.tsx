import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { 
  Shield, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Eye, 
  Check, 
  X, 
  BookOpen, 
  GraduationCap, 
  BarChart3, 
  UserCheck, 
  Download, 
  Plus, 
  Edit, 
  Trash2,
  LogOut,
  MousePointer,
  Award
} from "lucide-react";

interface Customer {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  isAdmin: boolean;
  certificateCount: number;
  totalSpent: number;
}

interface AdminCourse {
  id: number;
  title: string;
  description: string;
  slug: string;
  categoryId: number;
  categoryName: string;
  duration: number;
  passingScore: number;
  price: string;
  originalPrice: string;
  isOnSale: boolean;
  level: string;
  isActive: boolean;
  isInternship: boolean;
  createdAt: string;
  enrollmentCount: number;
  certificateCount: number;
  revenue: number;
}

interface ExamAttempt {
  id: number;
  userId: number;
  courseId: number;
  userEmail: string;
  userName: string;
  score: number;
  totalQuestions: number;
  timeTaken: number;
  createdAt: string;
  courseTitle: string;
  passed: boolean;
}

interface Transaction {
  id: number;
  transactionId: string;
  amount: string;
  status: string;
  createdAt: string;
  certificateId: number;
}

interface Partner {
  id: number;
  name: string;
  email: string;
  phone: string;
  referralCode: string;
  isApproved: boolean;
  totalEarnings: number;
  createdAt: string;
}

interface WithdrawalRequest {
  id: number;
  sellerId: number;
  amount: string;
  status: string;
  createdAt: string;
  sellerName: string;
  sellerEmail: string;
  upiId: string;
  accountHolderName: string;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  // Check admin authentication
  useEffect(() => {
    const adminToken = localStorage.getItem("adminToken");
    if (!adminToken) {
      setLocation("/admin/login");
      return;
    }
  }, [setLocation]);

  // Fetch analytics data
  const { data: analytics = {}, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/admin/analytics"],
  });

  // Fetch customers data
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ["/api/admin/customers"],
  });

  // Fetch admin courses data
  const { data: adminCourses = [], isLoading: adminCoursesLoading } = useQuery({
    queryKey: ["/api/admin/courses"],
  });

  // Fetch exam attempts data
  const { data: examAttempts = [], isLoading: examAttemptsLoading } = useQuery({
    queryKey: ["/api/admin/exam-attempts"],
  });

  // Fetch transactions data
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/admin/transactions"],
  });

  // Fetch partners data
  const { data: partners = [], isLoading: partnersLoading } = useQuery({
    queryKey: ["/api/admin/partners"],
  });

  // Fetch withdrawals data
  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useQuery({
    queryKey: ["/api/admin/withdrawals"],
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
        title: "Partner Updated",
        description: "Partner status has been updated successfully.",
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

  if (analyticsLoading) {
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Octamy Platform Administration</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" onClick={() => setLocation("/")}>
                <Eye className="w-4 h-4 mr-2" />
                View Site
              </Button>
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
        <div className="space-y-6">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="customers">Customers</TabsTrigger>
              <TabsTrigger value="courses">Courses</TabsTrigger>
              <TabsTrigger value="exams">Exams</TabsTrigger>
              <TabsTrigger value="partners">Partners</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Quick Stats */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.totalUsers || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Registered customers
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.totalCourses || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Available courses
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Certificates Issued</CardTitle>
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.totalCertificates || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Paid certificates
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
                      Platform earnings
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Customers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {customers?.slice(0, 5).map((customer: Customer) => (
                        <div key={customer.id} className="flex items-center">
                          <UserCheck className="h-4 w-4 text-muted-foreground" />
                          <div className="ml-4 space-y-1">
                            <p className="text-sm font-medium leading-none">{customer.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {customer.email} • {customer.certificateCount} certificates
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Courses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {adminCourses?.slice(0, 5).map((course: AdminCourse) => (
                        <div key={course.id} className="flex items-center">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <div className="ml-4 space-y-1">
                            <p className="text-sm font-medium leading-none">{course.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {course.enrollmentCount} enrollments • ₹{course.revenue} revenue
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="customers" className="space-y-4">
              {customersLoading ? (
                <div className="text-center py-8">Loading customers...</div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Management</CardTitle>
                    <CardDescription>Manage registered users and their activity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Certificates</TableHead>
                          <TableHead>Total Spent</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.map((customer: Customer) => (
                          <TableRow key={customer.id}>
                            <TableCell className="font-medium">{customer.name}</TableCell>
                            <TableCell>{customer.email}</TableCell>
                            <TableCell>{customer.certificateCount}</TableCell>
                            <TableCell>₹{customer.totalSpent}</TableCell>
                            <TableCell>{new Date(customer.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Badge variant={customer.isAdmin ? "destructive" : "default"}>
                                {customer.isAdmin ? "Admin" : "Customer"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="courses" className="space-y-4">
              {adminCoursesLoading ? (
                <div className="text-center py-8">Loading courses...</div>
              ) : (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Course Management</CardTitle>
                      <CardDescription>Manage courses, pricing, and content</CardDescription>
                    </div>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Course
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Course</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Enrollments</TableHead>
                          <TableHead>Certificates</TableHead>
                          <TableHead>Revenue</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminCourses.map((course: AdminCourse) => (
                          <TableRow key={course.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{course.title}</div>
                                <div className="text-sm text-muted-foreground">{course.duration} min • {course.passingScore}% pass</div>
                              </div>
                            </TableCell>
                            <TableCell>{course.categoryName}</TableCell>
                            <TableCell>
                              <div>
                                <span className="font-medium">₹{course.price}</span>
                                {course.isOnSale && course.originalPrice && (
                                  <span className="text-sm text-muted-foreground line-through ml-2">₹{course.originalPrice}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{course.enrollmentCount}</TableCell>
                            <TableCell>{course.certificateCount}</TableCell>
                            <TableCell>₹{course.revenue}</TableCell>
                            <TableCell>
                              <Badge variant={course.isActive ? "default" : "secondary"}>
                                {course.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="outline">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="outline">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="exams" className="space-y-4">
              {examAttemptsLoading ? (
                <div className="text-center py-8">Loading exam attempts...</div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Exam Management</CardTitle>
                    <CardDescription>Monitor exam attempts and results</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Course</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Result</TableHead>
                          <TableHead>Time Taken</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {examAttempts.map((attempt: ExamAttempt) => (
                          <TableRow key={attempt.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{attempt.userName}</div>
                                <div className="text-sm text-muted-foreground">{attempt.userEmail}</div>
                              </div>
                            </TableCell>
                            <TableCell>{attempt.courseTitle}</TableCell>
                            <TableCell>
                              <span className="font-medium">
                                {attempt.score}/{attempt.totalQuestions}
                              </span>
                              <span className="text-sm text-muted-foreground ml-2">
                                ({Math.round((attempt.score / attempt.totalQuestions) * 100)}%)
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={attempt.passed ? "default" : "destructive"}>
                                {attempt.passed ? "Passed" : "Failed"}
                              </Badge>
                            </TableCell>
                            <TableCell>{Math.round(attempt.timeTaken / 60)} min</TableCell>
                            <TableCell>{new Date(attempt.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="partners" className="space-y-4">
              {partnersLoading ? (
                <div className="text-center py-8">Loading partners...</div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Partner Management</CardTitle>
                    <CardDescription>Approve and manage affiliate partners</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Referral Code</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Earnings</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {partners.map((partner: Partner) => (
                          <TableRow key={partner.id}>
                            <TableCell className="font-medium">{partner.name}</TableCell>
                            <TableCell>{partner.email}</TableCell>
                            <TableCell>{partner.phone || "N/A"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{partner.referralCode}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={partner.isApproved ? "default" : "secondary"}>
                                {partner.isApproved ? "Approved" : "Pending"}
                              </Badge>
                            </TableCell>
                            <TableCell>₹{partner.totalEarnings || 0}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {!partner.isApproved && (
                                  <Button
                                    size="sm"
                                    onClick={() => approvePartnerMutation.mutate({ partnerId: partner.id, approved: true })}
                                    disabled={approvePartnerMutation.isPending}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button size="sm" variant="outline">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="transactions" className="space-y-4">
              {transactionsLoading ? (
                <div className="text-center py-8">Loading transactions...</div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                    <CardDescription>Monitor payment transactions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Transaction ID</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Certificate ID</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((transaction: Transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell className="font-medium">{transaction.transactionId}</TableCell>
                            <TableCell>₹{transaction.amount}</TableCell>
                            <TableCell>
                              <Badge variant={transaction.status === "success" ? "default" : "destructive"}>
                                {transaction.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{transaction.certificateId}</TableCell>
                            <TableCell>{new Date(transaction.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}