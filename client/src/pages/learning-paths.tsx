import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Clock, Trophy, Target, Star, Users, TrendingUp, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LearningPath {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  estimatedDuration: number;
  courseIds: number[];
  prerequisites: number[];
  categoryId: number;
  isActive: boolean;
  category: {
    id: number;
    name: string;
  };
}

interface UserLearningPath {
  id: number;
  userId: number;
  learningPathId: number;
  progress: number;
  completedCourses: number[];
  enrolledAt: Date;
  completedAt: Date | null;
  isActive: boolean;
  learningPath: LearningPath;
}

interface Recommendation {
  courseId: number;
  score: string;
  reason: string;
  metadata: {
    completedCourseIds?: number[];
    categoryMatch?: boolean;
    skillLevelMatch?: boolean;
    popularityScore?: number;
    trendingScore?: number;
  };
}

export default function LearningPaths() {
  const [activeTab, setActiveTab] = useState("discover");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: learningPaths = [], isLoading: pathsLoading } = useQuery({
    queryKey: ["/api/learning-paths"],
  });

  const { data: userPaths = [], isLoading: userPathsLoading } = useQuery({
    queryKey: ["/api/user/learning-paths"],
  });

  const { data: recommendations = [], isLoading: recommendationsLoading } = useQuery({
    queryKey: ["/api/recommendations/personalized"],
  });

  const { data: pathRecommendations = [], isLoading: pathRecommendationsLoading } = useQuery({
    queryKey: ["/api/recommendations/learning-paths"],
  });

  const enrollMutation = useMutation({
    mutationFn: async (learningPathId: number) => {
      await apiRequest(`/api/learning-paths/enroll`, {
        method: "POST",
        body: JSON.stringify({ learningPathId }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Enrolled Successfully",
        description: "You've been enrolled in the learning path!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/learning-paths"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Enrollment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case "beginner":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "intermediate":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "advanced":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const formatDuration = (hours: number) => {
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black dark:text-white mb-2">
            Learning Paths
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Structured learning journeys to master professional skills
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-100 dark:bg-gray-900">
            <TabsTrigger value="discover" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Discover
            </TabsTrigger>
            <TabsTrigger value="my-paths" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              My Paths
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Recommended
            </TabsTrigger>
            <TabsTrigger value="path-suggestions" className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              Path Suggestions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pathsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse border-gray-200 dark:border-gray-800">
                    <CardHeader>
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-5/6"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                learningPaths.map((path: LearningPath) => (
                  <Card key={path.id} className="border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg text-black dark:text-white">
                            {path.title}
                          </CardTitle>
                          <CardDescription className="text-gray-600 dark:text-gray-400 mt-1">
                            {path.category.name}
                          </CardDescription>
                        </div>
                        <Badge className={getDifficultyColor(path.difficulty)}>
                          {path.difficulty}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                        {path.description}
                      </p>
                      
                      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDuration(path.estimatedDuration)}
                        </div>
                        <div className="flex items-center gap-1">
                          <BookOpen className="w-4 h-4" />
                          {path.courseIds.length} courses
                        </div>
                      </div>

                      <Button
                        onClick={() => enrollMutation.mutate(path.id)}
                        disabled={enrollMutation.isPending}
                        className="w-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                      >
                        {enrollMutation.isPending ? "Enrolling..." : "Enroll Now"}
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="my-paths" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userPathsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="animate-pulse border-gray-200 dark:border-gray-800">
                    <CardHeader>
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/3"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : userPaths.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    No Learning Paths Yet
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Enroll in learning paths to track your progress
                  </p>
                  <Button
                    onClick={() => setActiveTab("discover")}
                    className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                  >
                    Explore Learning Paths
                  </Button>
                </div>
              ) : (
                userPaths.map((userPath: UserLearningPath) => (
                  <Card key={userPath.id} className="border-gray-200 dark:border-gray-800">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg text-black dark:text-white">
                            {userPath.learningPath.title}
                          </CardTitle>
                          <CardDescription className="text-gray-600 dark:text-gray-400 mt-1">
                            {userPath.learningPath.category.name}
                          </CardDescription>
                        </div>
                        {userPath.completedAt && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Progress</span>
                          <span className="text-black dark:text-white font-medium">
                            {Math.round(userPath.progress)}%
                          </span>
                        </div>
                        <Progress value={userPath.progress} className="h-2" />
                      </div>

                      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Trophy className="w-4 h-4" />
                          {userPath.completedCourses.length}/{userPath.learningPath.courseIds.length} completed
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDuration(userPath.learningPath.estimatedDuration)}
                        </div>
                      </div>

                      <Button
                        className="w-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                      >
                        Continue Learning
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="recommendations" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendationsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse border-gray-200 dark:border-gray-800">
                    <CardHeader>
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-5/6"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : recommendations.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    No Recommendations Yet
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Complete some courses to get personalized recommendations
                  </p>
                </div>
              ) : (
                recommendations.map((rec: Recommendation, index: number) => (
                  <Card key={index} className="border-gray-200 dark:border-gray-800">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg text-black dark:text-white">
                          Course Recommendation
                        </CardTitle>
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {Math.round(parseFloat(rec.score) * 100)}% match
                        </Badge>
                      </div>
                      <CardDescription className="text-gray-600 dark:text-gray-400">
                        {rec.reason}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                        {rec.metadata.categoryMatch && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            Category match
                          </div>
                        )}
                        {rec.metadata.skillLevelMatch && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            Skill level match
                          </div>
                        )}
                        {rec.metadata.popularityScore && (
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-500" />
                            Popular choice
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="path-suggestions" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pathRecommendationsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse border-gray-200 dark:border-gray-800">
                    <CardHeader>
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-5/6"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : pathRecommendations.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <Star className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    No Path Suggestions Yet
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Take a skill assessment to get personalized learning path suggestions
                  </p>
                </div>
              ) : (
                pathRecommendations.map((path: any, index: number) => (
                  <Card key={index} className="border-gray-200 dark:border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-lg text-black dark:text-white">
                        Suggested Learning Path
                      </CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-400">
                        Based on your skill assessment
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Personalized path suggestion based on your learning goals and progress
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}