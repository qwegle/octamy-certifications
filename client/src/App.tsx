import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth";
import Landing from "@/pages/landing";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth" component={Auth} />
      <Route path="/exam/:courseId" component={Exam} />
      <Route path="/payment/:certificateId" component={Payment} />
      <Route path="/certificate/:certificateId" component={Certificate} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/admin" component={Admin} />
      <Route path="/verify" component={Verification} />
      <Route path="/certificates/:certificateId" component={Certificate} />
      <Route path="/course/:slug" component={CourseDetail} />
      <Route path="/help-center" component={HelpCenter} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-of-service" component={TermsOfService} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
