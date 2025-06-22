import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth.tsx';
import { 
  TrendingUp, 
  Target, 
  Clock, 
  Award, 
  Brain,
  BarChart3,
  PieChart,
  Calendar
} from 'lucide-react';

interface AnalyticsData {
  totalCourses: number;
  completedCourses: number;
  averageScore: number;
  studyStreak: number;
  totalStudyTime: number;
  monthlyProgress: Array<{
    month: string;
    completed: number;
    score: number;
  }>;
  skillDistribution: Array<{
    skill: string;
    level: number;
    certificates: number;
  }>;
  upcomingDeadlines: Array<{
    title: string;
    date: string;
    type: string;
  }>;
}

export default function DashboardAnalytics() {
  const { user, token } = useAuth();

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/user/analytics'],
    enabled: !!user && !!token,
    queryFn: async () => {
      const response = await fetch('/api/user/analytics', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
  });

  if (isLoading || !analytics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const completionRate = analytics.totalCourses > 0 
    ? Math.round((analytics.completedCourses / analytics.totalCourses) * 100) 
    : 0;

  return (
    <div className="space-y-8">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                <p className="text-2xl font-bold text-gray-900">{completionRate}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${completionRate}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Average Score</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.averageScore}%</p>
                <p className="text-sm text-green-600">
                  {analytics.averageScore >= 80 ? '↗ Excellent' : analytics.averageScore >= 60 ? '→ Good' : '↘ Needs Improvement'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Study Streak</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.studyStreak}</p>
                <p className="text-sm text-gray-500">days in a row</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Brain className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Study Time</p>
                <p className="text-2xl font-bold text-gray-900">{Math.round(analytics.totalStudyTime / 60)}h</p>
                <p className="text-sm text-gray-500">total hours</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Chart and Skills */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Monthly Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.monthlyProgress.map((month, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-16 text-sm font-medium">{month.month}</div>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{month.completed} completed</span>
                        <span>{month.score}% avg</span>
                      </div>
                      <Progress value={(month.completed / 5) * 100} className="h-2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Skill Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="mr-2 h-5 w-5" />
              Skill Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.skillDistribution.map((skill, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-20 text-sm font-medium">{skill.skill}</div>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Level {skill.level}</span>
                        <span>{skill.certificates} certs</span>
                      </div>
                      <Progress value={(skill.level / 5) * 100} className="h-2" />
                    </div>
                  </div>
                  <Badge variant={skill.level >= 4 ? "default" : skill.level >= 3 ? "secondary" : "outline"}>
                    {skill.level >= 4 ? "Expert" : skill.level >= 3 ? "Advanced" : skill.level >= 2 ? "Intermediate" : "Beginner"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Deadlines */}
      {analytics.upcomingDeadlines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.upcomingDeadlines.map((deadline, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{deadline.title}</h4>
                    <p className="text-sm text-gray-500">{deadline.type}</p>
                  </div>
                  <Badge variant="outline">
                    {new Date(deadline.date).toLocaleDateString()}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}