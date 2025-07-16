import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth.tsx";
import { SellerAuthProvider } from "./lib/sellerAuth";
import { HelmetProvider } from 'react-helmet-async';
import Landing from "@/pages/landing-new";
import Exam from "@/pages/exam";
import Payment from "@/pages/payment";
import Certificate from "@/pages/certificate";
import Dashboard from "@/pages/dashboard";
import Admin from "@/pages/admin";
import Verification from "@/pages/verification";
import Auth from "@/pages/auth";
import NotFound from "@/pages/not-found";
import CourseDetail from "@/pages/course-detail";
import HelpCenter from "@/pages/help-center";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/terms-of-service";
import InternshipPayment from "@/pages/internship-payment";
import SellerAuth from "@/pages/seller-auth";
import SellerDashboard from "@/pages/seller-dashboard";
import PaymentSuccess from "@/pages/payment-success";
import PaymentFailed from "@/pages/payment-failed";
import DemoCertificate from "@/pages/demo-certificate";
import DemoBusinessCertificate from "@/pages/demo-business-certificate";
import DemoInternshipCertificate from "@/pages/demo-internship-certificate";
import BusinessCertificates from "@/pages/business-certificates";
import InternshipForm from "@/pages/internship-form";
import AIInterviews from "@/pages/ai-interviews";
import ProfileEdit from "@/pages/profile-edit";
import InterviewPayment from "@/pages/interview-payment";
import InterviewSession from "@/pages/interview-session";
import Verify from "@/pages/verify";
import Preferences from "@/pages/preferences";
import Progress from "@/pages/progress";
import EnhancedCheckout from "@/pages/EnhancedCheckout";
import Courses from "@/pages/courses";
import VirtualInternships from "@/pages/virtual-internships";
import BusinessCertificationsPage from "@/pages/business-certifications";
import LearningPaths from "@/pages/learning-paths";
import SponsorPage from "@/pages/sponsor";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import EnhancedAdminDashboard from "@/pages/enhanced-admin-dashboard";
import TempExamResults from "@/pages/TempExamResults";
import PaymentTemp from "@/pages/PaymentTemp";
import Contact from "@/pages/contact";


// Recruiter Portal Components
import { 
  RecruiterAuthProvider,
  RecruiterAuth,
  RecruiterOnboarding,
  RecruiterDashboard,
  CandidateSearch,
  CandidateProfile,
  RecruiterWallet,
  RecruiterProtectedRoute
} from "../../recruiter";
import InternShipPayment from "./pages/offlinInternshipPayment.tsx";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth" component={Auth} />
      <Route path="/login" component={Auth} />
      <Route path="/register" component={Auth} />
      <Route path="/logout" component={Auth} />
      <Route path="/exams" component={Courses} />
      <Route path="/virtual-internships" component={VirtualInternships} />
      <Route path="/business-certifications" component={BusinessCertificationsPage} />
      <Route path="/learning-paths" component={LearningPaths} />
      <Route path="/sponsor" component={SponsorPage} />
      <Route path="/intern-payment" component={InternShipPayment} />
      <Route path="/qwegle/login" component={AdminLogin} />
      <Route path="/qwegle/dashboard" component={AdminDashboard} />
      <Route path="/enhanced-admin" component={EnhancedAdminDashboard} />
      <Route path="/exam/:slug" component={Exam} />
      <Route path="/exam-results-temp/:tempExamId" component={TempExamResults} />
      <Route path="/payment" component={PaymentTemp} />
      <Route path="/checkout/:courseId" component={EnhancedCheckout} />
      <Route path="/payment/:certificateId" component={Payment} />
      <Route path="/internship-payment/:certificateId" component={InternshipPayment} />
      <Route path="/certificate/:certificateId" component={Certificate} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/progress" component={Progress} />
      <Route path="/preferences" component={Preferences} />
      <Route path="/qwegle" component={AdminDashboard} />
      <Route path="/verify" component={Verify} />
      <Route path="/verify/:certificateId" component={Verify} />
      <Route path="/certificates/:certificateId" component={Certificate} />
      <Route path="/course/:slug" component={CourseDetail} />
      <Route path="/courses/:slug" component={CourseDetail} />
      <Route path="/help-center" component={HelpCenter} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-of-service" component={TermsOfService} />
      <Route path="/seller-auth" component={SellerAuth} />
      <Route path="/partners" component={SellerAuth} />
      <Route path="/partner-dashboard" component={SellerDashboard} />
      <Route path="/payment-success" component={PaymentSuccess} />
      <Route path="/payment-failed" component={PaymentFailed} />
      <Route path="/demo-certificate" component={DemoCertificate} />
      <Route path="/demo-business-certificate" component={DemoBusinessCertificate} />
      <Route path="/demo-internship-certificate" component={DemoInternshipCertificate} />
      <Route path="/business-certificates" component={BusinessCertificates} />
      <Route path="/internship/:slug" component={InternshipForm} />
      <Route path="/contact" component={Contact} />
      <Route path="/ai-interviews" component={AIInterviews} />
      <Route path="/profile-edit" component={ProfileEdit} />
      <Route path="/interview/:id" component={InterviewSession} />
      <Route path="/interviews/:id" component={InterviewSession} />
      <Route path="/interview-results/:id" component={InterviewSession} />
      <Route path="/interviews/:id/payment" component={InterviewPayment} />
      
      {/* Recruiter Portal Routes */}
      <Route path="/recruiter/auth" component={RecruiterAuth} />
      <Route path="/recruiter/onboarding" component={RecruiterOnboarding} />
      <Route path="/recruiter/dashboard">
        {() => (
          <RecruiterProtectedRoute>
            <RecruiterDashboard />
          </RecruiterProtectedRoute>
        )}
      </Route>
      <Route path="/recruiter/search">
        {() => (
          <RecruiterProtectedRoute requireKyc>
            <CandidateSearch />
          </RecruiterProtectedRoute>
        )}
      </Route>
      <Route path="/recruiter/profile/:id">
        {() => (
          <RecruiterProtectedRoute requireKyc>
            <CandidateProfile />
          </RecruiterProtectedRoute>
        )}
      </Route>
      <Route path="/recruiter/wallet">
        {() => (
          <RecruiterProtectedRoute>
            <RecruiterWallet />
          </RecruiterProtectedRoute>
        )}
      </Route>
      <Route path="/recruiter/profile">
        {() => (
          <RecruiterProtectedRoute>
            <RecruiterProfile />
          </RecruiterProtectedRoute>
        )}
      </Route>
      <Route path="/recruiter/settings">
        {() => (
          <RecruiterProtectedRoute>
            <RecruiterSettings />
          </RecruiterProtectedRoute>
        )}
      </Route>
      <Route path="/recruiter/payment-success" component={PaymentSuccess} />
      <Route path="/recruiter/payment-failed" component={PaymentFailed} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SellerAuthProvider>
            <RecruiterAuthProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
              </TooltipProvider>
            </RecruiterAuthProvider>
          </SellerAuthProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
