import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { CourseProgressVisualization } from '@/components/progress/CourseProgressVisualization';
import { useToast } from '@/hooks/use-toast';

export default function ProgressPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to view your progress.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-soft dark:bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-black dark:border-white"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-cream-soft dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black dark:text-white mb-4">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-soft dark:bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black dark:text-white mb-2">
            Your Learning Progress
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Track your achievements and course completion status
          </p>
        </div>
        
        <CourseProgressVisualization userId={user?.id} />
      </div>
    </div>
  );
}