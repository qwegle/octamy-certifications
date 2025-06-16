import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { CourseProgressVisualization } from '@/components/progress/CourseProgressVisualization';
import { TrendingUp, Award, Target, BarChart3 } from 'lucide-react';

export default function ProgressPage() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-400 mb-8">Please log in to view your progress</p>
          <a 
            href="/api/login" 
            className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header Section */}
      <div className="border-b border-white/10 bg-gradient-to-r from-black to-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Your Learning Journey
            </h1>
            <p className="text-xl text-gray-400 mb-8">
              Track your progress, unlock achievements, and master new skills
            </p>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-12">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-3 text-green-400" />
                <h3 className="font-bold text-lg">Progress</h3>
                <p className="text-gray-400">Track completion</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                <Award className="w-8 h-8 mx-auto mb-3 text-yellow-400" />
                <h3 className="font-bold text-lg">Achievements</h3>
                <p className="text-gray-400">Unlock rewards</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                <Target className="w-8 h-8 mx-auto mb-3 text-blue-400" />
                <h3 className="font-bold text-lg">Goals</h3>
                <p className="text-gray-400">Set targets</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                <BarChart3 className="w-8 h-8 mx-auto mb-3 text-purple-400" />
                <h3 className="font-bold text-lg">Analytics</h3>
                <p className="text-gray-400">View insights</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Progress Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <CourseProgressVisualization userId={user?.id} />
      </div>
    </div>
  );
}