import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { CourseProgressVisualization } from '@/components/progress/CourseProgressVisualization';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/dashboard-layout';
import { useLocation } from 'wouter';

export default function ProgressPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to view your progress.",
        variant: "destructive",
      });
      setLocation('/login?next=/progress');
    }
  }, [isAuthenticated, isLoading, toast, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-soft flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-300 border-t-slate-900"></div></div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-cream-soft flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-4">Login required</h1>
          <p className="text-gray-600">Redirecting to login…</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout role="learner" title="Learning progress" description="Track your achievements and course completion status.">
      <div className="max-w-7xl mx-auto">
        <CourseProgressVisualization userId={user?.id} />
      </div>
    </DashboardLayout>
  );
}
