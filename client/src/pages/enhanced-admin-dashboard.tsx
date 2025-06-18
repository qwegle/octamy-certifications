import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Users, BookOpen, DollarSign, FileText, TrendingUp, Activity, Search, Filter, RefreshCw, Eye, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function EnhancedAdminDashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [examAttempts, setExamAttempts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerms, setSearchTerms] = useState({
    courses: '',
    customers: '',
    transactions: '',
    partners: '',
    examAttempts: ''
  });
  const { toast } = useToast();

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login';
  };

  const fetchData = async (searchFilters = {}) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        toast({
          title: "Authentication Error",
          description: "Admin token not found. Please login again.",
          variant: "destructive",
        });
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch analytics
      const analyticsResponse = await fetch('/api/admin/analytics', { headers });
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setAnalytics(analyticsData);
      }

      // Fetch categories with course count
      const categoriesResponse = await fetch('/api/admin/categories', { headers });
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json();
        setCategories(categoriesData);
      }

      // Fetch courses with search
      const coursesParams = new URLSearchParams();
      if (searchFilters.courses || searchTerms.courses) {
        coursesParams.append('search', searchFilters.courses || searchTerms.courses);
      }
      const coursesResponse = await fetch(`/api/admin/courses?${coursesParams}`, { headers });
      if (coursesResponse.ok) {
        const coursesData = await coursesResponse.json();
        setCourses(coursesData);
      }

      // Fetch customers with search
      const customersParams = new URLSearchParams();
      if (searchFilters.customers || searchTerms.customers) {
        customersParams.append('search', searchFilters.customers || searchTerms.customers);
      }
      const customersResponse = await fetch(`/api/admin/customers?${customersParams}`, { headers });
      if (customersResponse.ok) {
        const customersData = await customersResponse.json();
        setCustomers(customersData);
      }

      // Fetch transactions with search
      const transactionsParams = new URLSearchParams();
      if (searchFilters.transactions || searchTerms.transactions) {
        transactionsParams.append('search', searchFilters.transactions || searchTerms.transactions);
      }
      const transactionsResponse = await fetch(`/api/admin/transactions?${transactionsParams}`, { headers });
      if (transactionsResponse.ok) {
        const transactionsData = await transactionsResponse.json();
        setTransactions(transactionsData);
      }

      // Fetch partners with search
      const partnersParams = new URLSearchParams();
      if (searchFilters.partners || searchTerms.partners) {
        partnersParams.append('search', searchFilters.partners || searchTerms.partners);
      }
      const partnersResponse = await fetch(`/api/admin/partners?${partnersParams}`, { headers });
      if (partnersResponse.ok) {
        const partnersData = await partnersResponse.json();
        setPartners(partnersData);
      }

      // Fetch exam attempts with search
      const examAttemptsParams = new URLSearchParams();
      if (searchFilters.examAttempts || searchTerms.examAttempts) {
        examAttemptsParams.append('search', searchFilters.examAttempts || searchTerms.examAttempts);
      }
      const examAttemptsResponse = await fetch(`/api/admin/exam-attempts?${examAttemptsParams}`, { headers });
      if (examAttemptsResponse.ok) {
        const examAttemptsData = await examAttemptsResponse.json();
        setExamAttempts(examAttemptsData);
      }

    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch admin data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (tab: string, term: string) => {
    setSearchTerms(prev => ({ ...prev, [tab]: term }));
    fetchData({ [tab]: term });
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-4" />
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Enhanced Admin Dashboard</h1>
            <p className="text-gray-400 mt-2">Advanced analytics and comprehensive platform management</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => window.location.href = '/admin'}
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-black"
            >
              <Users className="h-4 w-4 mr-2" />
              Standard Version
            </Button>
            <Button
              variant="outline"
              onClick={() => fetchData()}
              className="border-white text-white hover:bg-white hover:text-black"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={handleLogout}
              variant="outline"
              className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            >
              <Users className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-gray-900">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-black">Overview</TabsTrigger>
            <TabsTrigger value="courses" className="data-[state=active]:bg-white data-[state=active]:text-black">Courses</TabsTrigger>
            <TabsTrigger value="customers" className="data-[state=active]:bg-white data-[state=active]:text-black">Customers</TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-white data-[state=active]:text-black">Transactions</TabsTrigger>
            <TabsTrigger value="partners" className="data-[state=active]:bg-white data-[state=active]:text-black">Partners</TabsTrigger>
            <TabsTrigger value="exams" className="data-[state=active]:bg-white data-[state=active]:text-black">Exams</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-white">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-gray-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{analytics?.totalUsers || 0}</div>
                    <p className="text-xs text-gray-400">
                      +{analytics?.newUsersThisMonth || 0} from last month
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-white">Total Courses</CardTitle>
                    <BookOpen className="h-4 w-4 text-gray-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{analytics?.totalCourses || 0}</div>
                    <p className="text-xs text-gray-400">
                      Active courses available
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-white">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-gray-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">₹{analytics?.totalRevenue || 0}</div>
                    <p className="text-xs text-gray-400">
                      +₹{analytics?.revenueThisMonth || 0} from this month
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-white">Certificates Issued</CardTitle>
                    <FileText className="h-4 w-4 text-gray-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{analytics?.totalCertificates || 0}</div>
                    <p className="text-xs text-gray-400">
                      +{analytics?.certificatesThisMonth || 0} this month
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Categories Overview */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Categories Overview</CardTitle>
                  <CardDescription className="text-gray-400">Course distribution across categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {categories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between p-4 border border-gray-800 rounded-lg">
                        <div>
                          <h3 className="font-medium text-white">{category.name}</h3>
                          <p className="text-sm text-gray-400">{category.description}</p>
                        </div>
                        <Badge variant="secondary" className="bg-gray-800 text-white">{category.courseCount} courses</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="courses">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Course Management</CardTitle>
                <CardDescription className="text-gray-400">Manage courses and their content</CardDescription>
                <div className="flex items-center space-x-2 mt-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search courses by title, ID, or category..."
                      value={searchTerms.courses}
                      onChange={(e) => handleSearch('courses', e.target.value)}
                      className="pl-8 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchData()}
                    className="border-gray-700 text-white hover:bg-gray-800"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-gray-800">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800 hover:bg-gray-800">
                        <TableHead className="text-gray-300">ID</TableHead>
                        <TableHead className="text-gray-300">Course</TableHead>
                        <TableHead className="text-gray-300">Category</TableHead>
                        <TableHead className="text-gray-300">Price</TableHead>
                        <TableHead className="text-gray-300">Enrollments</TableHead>
                        <TableHead className="text-gray-300">Certificates</TableHead>
                        <TableHead className="text-gray-300">Revenue</TableHead>
                        <TableHead className="text-gray-300">Status</TableHead>
                        <TableHead className="text-gray-300">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courses.map((course) => (
                        <TableRow key={course.id} className="border-gray-800 hover:bg-gray-800">
                          <TableCell className="font-mono text-sm text-white">{course.id}</TableCell>
                          <TableCell className="font-medium text-white">{course.title}</TableCell>
                          <TableCell className="text-gray-300">{course.category?.name || 'N/A'}</TableCell>
                          <TableCell className="text-white">₹{course.price}</TableCell>
                          <TableCell className="text-white">{course.enrollmentCount || 0}</TableCell>
                          <TableCell className="text-white">{course.certificateCount || 0}</TableCell>
                          <TableCell className="text-white">₹{course.revenue || 0}</TableCell>
                          <TableCell>
                            <Badge variant={course.isActive ? "default" : "secondary"} className={course.isActive ? "bg-green-600" : "bg-gray-600"}>
                              {course.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button variant="outline" size="sm" className="border-gray-700 text-white hover:bg-gray-800">
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button variant="outline" size="sm" className="border-gray-700 text-white hover:bg-gray-800">
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Customer Management</CardTitle>
                <CardDescription className="text-gray-400">View and manage customer accounts</CardDescription>
                <div className="flex items-center space-x-2 mt-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search customers by name, email, or ID..."
                      value={searchTerms.customers}
                      onChange={(e) => handleSearch('customers', e.target.value)}
                      className="pl-8 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchData()}
                    className="border-gray-700 text-white hover:bg-gray-800"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-gray-800">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800 hover:bg-gray-800">
                        <TableHead className="text-gray-300">ID</TableHead>
                        <TableHead className="text-gray-300">Name</TableHead>
                        <TableHead className="text-gray-300">Email</TableHead>
                        <TableHead className="text-gray-300">Certificates</TableHead>
                        <TableHead className="text-gray-300">Total Spent</TableHead>
                        <TableHead className="text-gray-300">Exam Attempts</TableHead>
                        <TableHead className="text-gray-300">Joined</TableHead>
                        <TableHead className="text-gray-300">Role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map((customer) => (
                        <TableRow key={customer.id} className="border-gray-800 hover:bg-gray-800">
                          <TableCell className="font-mono text-sm text-white">{customer.id}</TableCell>
                          <TableCell className="font-medium text-white">{customer.name}</TableCell>
                          <TableCell className="text-gray-300">{customer.email}</TableCell>
                          <TableCell className="text-white">{customer.certificateCount || 0}</TableCell>
                          <TableCell className="text-white">₹{customer.totalSpent || 0}</TableCell>
                          <TableCell className="text-white">{customer.examAttempts || 0}</TableCell>
                          <TableCell className="text-gray-300">{format(new Date(customer.createdAt || new Date()), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>
                            <Badge variant={customer.isAdmin ? "destructive" : "default"} className={customer.isAdmin ? "bg-red-600" : "bg-blue-600"}>
                              {customer.isAdmin ? "Admin" : "User"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Transaction Management</CardTitle>
                <CardDescription className="text-gray-400">View payment transactions and revenue</CardDescription>
                <div className="flex items-center space-x-2 mt-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search transactions by ID or transaction ID..."
                      value={searchTerms.transactions}
                      onChange={(e) => handleSearch('transactions', e.target.value)}
                      className="pl-8 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchData()}
                    className="border-gray-700 text-white hover:bg-gray-800"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-gray-800">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800 hover:bg-gray-800">
                        <TableHead className="text-gray-300">ID</TableHead>
                        <TableHead className="text-gray-300">Transaction ID</TableHead>
                        <TableHead className="text-gray-300">User</TableHead>
                        <TableHead className="text-gray-300">Course</TableHead>
                        <TableHead className="text-gray-300">Amount</TableHead>
                        <TableHead className="text-gray-300">Certificate Amount</TableHead>
                        <TableHead className="text-gray-300">Status</TableHead>
                        <TableHead className="text-gray-300">Method</TableHead>
                        <TableHead className="text-gray-300">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id} className="border-gray-800 hover:bg-gray-800">
                          <TableCell className="font-mono text-sm text-white">{transaction.id}</TableCell>
                          <TableCell className="font-mono text-sm text-white">{transaction.transactionId}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-white">{transaction.userName}</div>
                              <div className="text-sm text-gray-400">{transaction.userEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-300">{transaction.courseTitle}</TableCell>
                          <TableCell className="text-white">₹{transaction.amount}</TableCell>
                          <TableCell className="text-white">₹{transaction.certificateAmount}</TableCell>
                          <TableCell>
                            <Badge variant={
                              transaction.status === 'success' ? "default" : 
                              transaction.status === 'failed' ? "destructive" : "secondary"
                            } className={
                              transaction.status === 'success' ? "bg-green-600" : 
                              transaction.status === 'failed' ? "bg-red-600" : "bg-gray-600"
                            }>
                              {transaction.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-300">{transaction.paymentMethod}</TableCell>
                          <TableCell className="text-gray-300">{format(new Date(transaction.createdAt || new Date()), 'MMM dd, yyyy HH:mm')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="partners">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Partner Management</CardTitle>
                <CardDescription className="text-gray-400">Manage affiliate partners and commissions</CardDescription>
                <div className="flex items-center space-x-2 mt-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search partners by name, email, or referral code..."
                      value={searchTerms.partners}
                      onChange={(e) => handleSearch('partners', e.target.value)}
                      className="pl-8 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchData()}
                    className="border-gray-700 text-white hover:bg-gray-800"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-gray-800">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800 hover:bg-gray-800">
                        <TableHead className="text-gray-300">ID</TableHead>
                        <TableHead className="text-gray-300">Name</TableHead>
                        <TableHead className="text-gray-300">Email</TableHead>
                        <TableHead className="text-gray-300">Referral Code</TableHead>
                        <TableHead className="text-gray-300">Clicks</TableHead>
                        <TableHead className="text-gray-300">Conversions</TableHead>
                        <TableHead className="text-gray-300">Total Earnings</TableHead>
                        <TableHead className="text-gray-300">Pending</TableHead>
                        <TableHead className="text-gray-300">Status</TableHead>
                        <TableHead className="text-gray-300">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partners.map((partner) => (
                        <TableRow key={partner.id} className="border-gray-800 hover:bg-gray-800">
                          <TableCell className="font-mono text-sm text-white">{partner.id}</TableCell>
                          <TableCell className="font-medium text-white">{partner.name}</TableCell>
                          <TableCell className="text-gray-300">{partner.email}</TableCell>
                          <TableCell className="font-mono text-sm text-white">{partner.referralCode}</TableCell>
                          <TableCell className="text-white">{partner.clickCount || 0}</TableCell>
                          <TableCell className="text-white">{partner.conversionCount || 0}</TableCell>
                          <TableCell className="text-white">₹{partner.totalEarnings || 0}</TableCell>
                          <TableCell className="text-white">₹{partner.pendingEarnings || 0}</TableCell>
                          <TableCell>
                            <Badge variant={
                              partner.isApproved && partner.isActive ? "default" : 
                              partner.isApproved ? "secondary" : "destructive"
                            } className={
                              partner.isApproved && partner.isActive ? "bg-green-600" : 
                              partner.isApproved ? "bg-gray-600" : "bg-red-600"
                            }>
                              {partner.isApproved ? (partner.isActive ? "Active" : "Inactive") : "Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button variant="outline" size="sm" className="border-gray-700 text-white hover:bg-gray-800">
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button variant="outline" size="sm" className="border-gray-700 text-white hover:bg-gray-800">
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exams">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Exam Management</CardTitle>
                <CardDescription className="text-gray-400">View exam attempts and student performance</CardDescription>
                <div className="flex items-center space-x-2 mt-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by student name, email, or course..."
                      value={searchTerms.examAttempts}
                      onChange={(e) => handleSearch('examAttempts', e.target.value)}
                      className="pl-8 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchData()}
                    className="border-gray-700 text-white hover:bg-gray-800"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-gray-800">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800 hover:bg-gray-800">
                        <TableHead className="text-gray-300">ID</TableHead>
                        <TableHead className="text-gray-300">Student</TableHead>
                        <TableHead className="text-gray-300">Course</TableHead>
                        <TableHead className="text-gray-300">Score</TableHead>
                        <TableHead className="text-gray-300">Percentage</TableHead>
                        <TableHead className="text-gray-300">Status</TableHead>
                        <TableHead className="text-gray-300">Time Taken</TableHead>
                        <TableHead className="text-gray-300">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {examAttempts.map((attempt) => (
                        <TableRow key={attempt.id} className="border-gray-800 hover:bg-gray-800">
                          <TableCell className="font-mono text-sm text-white">{attempt.id}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-white">{attempt.userName}</div>
                              <div className="text-sm text-gray-400">{attempt.userEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-300">{attempt.courseTitle}</TableCell>
                          <TableCell className="text-white">{attempt.score}/{attempt.totalQuestions}</TableCell>
                          <TableCell className="text-white">{Math.round((attempt.score / attempt.totalQuestions) * 100)}%</TableCell>
                          <TableCell>
                            <Badge variant={attempt.passed ? "default" : "destructive"} className={attempt.passed ? "bg-green-600" : "bg-red-600"}>
                              {attempt.passed ? "Passed" : "Failed"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-300">{Math.floor(attempt.timeTaken / 60)}m {attempt.timeTaken % 60}s</TableCell>
                          <TableCell className="text-gray-300">{format(new Date(attempt.createdAt), 'MMM dd, yyyy HH:mm')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default EnhancedAdminDashboard;