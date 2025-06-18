import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth";
import { SellerAuthProvider } from "./lib/sellerAuth";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth" component={Auth} />
      <Route path="/courses" component={Courses} />
      <Route path="/virtual-internships" component={VirtualInternships} />
      <Route path="/business-certifications" component={BusinessCertificationsPage} />
      <Route path="/learning-paths" component={LearningPaths} />
      <Route path="/sponsor" component={SponsorPage} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/enhanced-admin" component={() => import("./pages/enhanced-admin-dashboard").then(m => m.default)} />
      <Route path="/exam/:courseId" component={Exam} />
      <Route path="/checkout/:courseId" component={EnhancedCheckout} />
      <Route path="/payment/:certificateId" component={Payment} />
      <Route path="/internship-payment/:certificateId" component={InternshipPayment} />
      <Route path="/certificate/:certificateId" component={Certificate} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/progress" component={Progress} />
      <Route path="/preferences" component={Preferences} />
      <Route path="/admin" component={Admin} />
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SellerAuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </SellerAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
