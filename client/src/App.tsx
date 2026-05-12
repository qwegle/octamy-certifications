import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth.tsx";
import { SellerAuthProvider } from "./lib/sellerAuth";
import { HelmetProvider } from 'react-helmet-async';
const Landing = lazy(() => import("@/pages/landing-new"));
const Exam = lazy(() => import("@/pages/exam"));
const Payment = lazy(() => import("@/pages/payment"));
const Certificate = lazy(() => import("@/pages/certificate"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Admin = lazy(() => import("@/pages/admin"));
const Verification = lazy(() => import("@/pages/verification"));
const Auth = lazy(() => import("@/pages/auth"));
const Login = lazy(() => import("@/pages/login"));
const Register = lazy(() => import("@/pages/register"));
const CreatorDashboard = lazy(() => import("@/pages/creator-dashboard"));
const CreatorCourses = lazy(() => import("@/pages/creator-courses"));
const CreatorCourseNew = lazy(() => import("@/pages/creator-course-new"));
const CreatorPayouts = lazy(() => import("@/pages/creator-payouts"));
const ExamShare = lazy(() => import("@/pages/exam-share"));
const InstituteDashboard = lazy(() => import("@/pages/institute-dashboard"));
const InstituteStudents = lazy(() => import("@/pages/institute-students"));
const InstituteExams = lazy(() => import("@/pages/institute-exams"));
const InstituteExamNew = lazy(() => import("@/pages/institute-exam-new"));
const InstituteExamEdit = lazy(() => import("@/pages/institute-exam-edit"));
const InstituteReports = lazy(() => import("@/pages/institute-reports"));
const InstituteTeam = lazy(() => import("@/pages/institute-team"));
const CreatorCurriculum = lazy(() => import("@/pages/creator-curriculum"));
const CreatorEarnings = lazy(() => import("@/pages/creator-earnings"));
const RecruiterSavedSearches = lazy(() => import("@/pages/recruiter-saved-searches"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const CreatorLanding = lazy(() => import("@/pages/creator-landing"));
const InstituteLanding = lazy(() => import("@/pages/institute-landing"));
const RecruiterLanding = lazy(() => import("@/pages/recruiter-landing"));
const Pricing = lazy(() => import("@/pages/pricing"));
const NotFound = lazy(() => import("@/pages/not-found"));
const HelpCenter = lazy(() => import("@/pages/help-center"));
const About = lazy(() => import("@/pages/about"));
const CategoryPage = lazy(() => import("@/pages/category"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const TermsOfService = lazy(() => import("@/pages/terms-of-service"));
const TrustPage = lazy(() => import("@/pages/legal/trust"));
const RefundPolicy = lazy(() => import("@/pages/legal/refund-policy"));
const CookiePolicy = lazy(() => import("@/pages/legal/cookie-policy"));
const AcceptableUse = lazy(() => import("@/pages/legal/acceptable-use"));
const DisclaimerPage = lazy(() => import("@/pages/legal/disclaimer"));
const ResellerAgreement = lazy(() => import("@/pages/legal/reseller-agreement"));
const AccessibilityPage = lazy(() => import("@/pages/legal/accessibility"));
import { CookieConsent } from "@/components/cookie-consent";
const InternshipPayment = lazy(() => import("@/pages/internship-payment"));
const SellerAuth = lazy(() => import("@/pages/seller-auth"));
const SellerDashboard = lazy(() => import("@/pages/seller-dashboard"));
const PaymentSuccess = lazy(() => import("@/pages/payment-success"));
const PaymentFailed = lazy(() => import("@/pages/payment-failed"));
const DemoCertificate = lazy(() => import("@/pages/demo-certificate"));
const DemoBusinessCertificate = lazy(() => import("@/pages/demo-business-certificate"));
const DemoInternshipCertificate = lazy(() => import("@/pages/demo-internship-certificate"));
const BusinessCertificates = lazy(() => import("@/pages/business-certificates"));
const InternshipForm = lazy(() => import("@/pages/internship-form"));
const ProfileEdit = lazy(() => import("@/pages/profile-edit"));
const Verify = lazy(() => import("@/pages/verify"));
const Preferences = lazy(() => import("@/pages/preferences"));
const Progress = lazy(() => import("@/pages/progress"));
const EnhancedCheckout = lazy(() => import("@/pages/EnhancedCheckout"));
const Courses = lazy(() => import("@/pages/courses"));
const VirtualInternships = lazy(() => import("@/pages/virtual-internships"));
const BusinessCertificationsPage = lazy(() => import("@/pages/business-certifications"));
const LearningPaths = lazy(() => import("@/pages/learning-paths"));
const SponsorPage = lazy(() => import("@/pages/sponsor"));
const AdminLogin = lazy(() => import("@/pages/admin-login"));
const AdminDashboard = lazy(() => import("@/pages/admin-dashboard"));
const AdminApprovals = lazy(() => import("@/pages/admin-approvals"));
const EnhancedAdminDashboard = lazy(() => import("@/pages/enhanced-admin-dashboard"));
const TempExamResults = lazy(() => import("@/pages/TempExamResults"));
const PaymentTemp = lazy(() => import("@/pages/PaymentTemp"));
const Contact = lazy(() => import("@/pages/contact"));
// Recruiter Portal Components
import { 
  RecruiterAuthProvider,
  RecruiterAuth,
  RecruiterOnboarding,
  RecruiterDashboard,
  RecruiterAnalytics,
  CandidateSearch,
  CandidateProfile,
  RecruiterWallet,
  RecruiterProfile,
  RecruiterSettings,
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
    <Suspense fallback={<QBLoader />}>
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
      <Route path="/admin/approvals" component={AdminApprovals} />
      <Route path="/qwegle/approvals" component={AdminApprovals} />
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
      <Route path="/creator/courses" component={CreatorCourses} />
      <Route path="/creator/courses/new" component={CreatorCourseNew} />
      <Route path="/creator/payouts" component={CreatorPayouts} />
      <Route path="/x/:code" component={ExamShare} />
      <Route path="/institute/dashboard" component={InstituteDashboard} />
      <Route path="/institute/students" component={InstituteStudents} />
      <Route path="/institute/cohorts" component={InstituteStudents} />
      <Route path="/institute/exams" component={InstituteExams} />
      <Route path="/institute/exams/new" component={InstituteExamNew} />
      <Route path="/institute/exams/:id/edit" component={InstituteExamEdit} />
      <Route path="/institute/reports" component={InstituteReports} />
      <Route path="/institute/team" component={InstituteTeam} />
      <Route path="/creator/courses/:id/curriculum" component={CreatorCurriculum} />
      <Route path="/creator/earnings" component={CreatorEarnings} />
      <Route path="/recruiter/saved-searches">
        {() => (
          <RecruiterProtectedRoute>
            <RecruiterSavedSearches />
          </RecruiterProtectedRoute>
        )}
      </Route>
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
      <Route path="/recruiter/analytics">
        {() => (
          <RecruiterProtectedRoute>
            <RecruiterAnalytics />
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
    </Suspense>
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
