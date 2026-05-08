import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
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
import Login from "@/pages/login";
import Register from "@/pages/register";
import CreatorDashboard from "@/pages/creator-dashboard";
import InstituteDashboard from "@/pages/institute-dashboard";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import CreatorLanding from "@/pages/creator-landing";
import InstituteLanding from "@/pages/institute-landing";
import RecruiterLanding from "@/pages/recruiter-landing";
import Pricing from "@/pages/pricing";
import NotFound from "@/pages/not-found";
import HelpCenter from "@/pages/help-center";
import About from "@/pages/about";
import CategoryPage from "@/pages/category";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/terms-of-service";
import TrustPage from "@/pages/legal/trust";
import RefundPolicy from "@/pages/legal/refund-policy";
import CookiePolicy from "@/pages/legal/cookie-policy";
import AcceptableUse from "@/pages/legal/acceptable-use";
import DisclaimerPage from "@/pages/legal/disclaimer";
import ResellerAgreement from "@/pages/legal/reseller-agreement";
import AccessibilityPage from "@/pages/legal/accessibility";
import { CookieConsent } from "@/components/cookie-consent";
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
import ProfileEdit from "@/pages/profile-edit";
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

// P1 Question Bank Pro — lazy-loaded
const QuestionBanksList = lazy(() => import("@/pages/question-banks-list"));
const QuestionBankDetail = lazy(() => import("@/pages/question-bank-detail"));
const BlueprintEditor = lazy(() => import("@/pages/blueprint-editor"));

const QBLoader = () => (
  <div className="min-h-screen flex items-center justify-center text-gray-500">
    Loading…
  </div>
);

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth" component={Auth} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password/:token" component={ResetPassword} />
      <Route path="/logout" component={Auth} />

      {/* Role-prefixed canonical auth — all unified Login / Register */}
      <Route path="/partners/login" component={Login} />
      <Route path="/partners/register" component={Register} />
      <Route path="/recruiter/login" component={Login} />
      <Route path="/recruiter/register" component={Register} />
      <Route path="/creator/login" component={Login} />
      <Route path="/creator/register" component={Register} />
      <Route path="/institute/login" component={Login} />
      <Route path="/institute/register" component={Register} />

      {/* Marketing landings */}
      <Route path="/creator" component={CreatorLanding} />
      <Route path="/institute" component={InstituteLanding} />
      <Route path="/for-recruiters" component={RecruiterLanding} />

      {/* Pricing */}
      <Route path="/pricing" component={Pricing} />
      <Route path="/exams" component={Courses} />
      <Route path="/courses" component={Courses} />
      <Route path="/skill-verification" component={Courses} />
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
      <Route path="/creator/dashboard" component={CreatorDashboard} />
      <Route path="/institute/dashboard" component={InstituteDashboard} />
      <Route path="/progress" component={Progress} />
      <Route path="/preferences" component={Preferences} />
      <Route path="/qwegle" component={AdminDashboard} />
      <Route path="/verify" component={Verify} />
      <Route path="/verify/:certificateId" component={Verify} />
      <Route path="/certificates/:certificateId" component={Certificate} />
      <Route path="/help-center" component={HelpCenter} />
      <Route path="/about" component={About} />
      <Route path="/category/:slug" component={CategoryPage} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-of-service" component={TermsOfService} />
      <Route path="/trust" component={TrustPage} />
      <Route path="/legal" component={TrustPage} />
      <Route path="/compliance" component={TrustPage} />
      <Route path="/refund-policy" component={RefundPolicy} />
      <Route path="/cookie-policy" component={CookiePolicy} />
      <Route path="/acceptable-use" component={AcceptableUse} />
      <Route path="/disclaimer" component={DisclaimerPage} />
      <Route path="/reseller-agreement" component={ResellerAgreement} />
      <Route path="/accessibility" component={AccessibilityPage} />
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
      <Route path="/profile-edit" component={ProfileEdit} />
      
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

      {/* P1 Question Bank Pro */}
      <Route path="/question-banks">
        {() => <Suspense fallback={<QBLoader />}><QuestionBanksList /></Suspense>}
      </Route>
      <Route path="/question-banks/:id">
        {() => <Suspense fallback={<QBLoader />}><QuestionBankDetail /></Suspense>}
      </Route>
      <Route path="/admin/courses/:courseId/blueprint">
        {() => <Suspense fallback={<QBLoader />}><BlueprintEditor /></Suspense>}
      </Route>

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
                <CookieConsent />
              </TooltipProvider>
            </RecruiterAuthProvider>
          </SellerAuthProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
