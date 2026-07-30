import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Clock, Trophy, Target, Star, Users, TrendingUp, CheckCircle, Lock, Play, Zap, Brain, Code, Shield, ArrowRight, GitBranch, Network, TreePine, Workflow, Lightbulb } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

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
  tags?: string[];
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

interface Course {
  id: number;
  title: string;
  description: string;
  level: string;
  duration: number;
  price: string;
  categoryId: number;
  category: {
    name: string;
  };
}

interface Recommendation {
  courseId: number;
  course: Course;
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

interface PathTreeNode {
  id: number;
  title: string;
  level: number;
  isCompleted: boolean;
  isUnlocked: boolean;
  prerequisites: number[];
  children: PathTreeNode[];
  course?: Course;
}

export default function LearningPaths() {
  const [activeTab, setActiveTab] = useState("discover");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: learningPaths = [], isLoading: pathsLoading } = useQuery<LearningPath[]>({
    queryKey: ["/api/learning-paths"],
  });

  const { data: userPaths = [], isLoading: userPathsLoading } = useQuery<UserLearningPath[]>({
    queryKey: ["/api/user/learning-paths"],
  });

  const { data: recommendations = [], isLoading: recommendationsLoading } = useQuery<Recommendation[]>({
    queryKey: ["/api/recommendations/personalized"],
  });

  const { data: pathRecommendations = [], isLoading: pathRecommendationsLoading } = useQuery<any[]>({
    queryKey: ["/api/recommendations/learning-paths"],
  });

  // Get course recommendations for enrolled learning paths
  const { data: enrolledPathRecommendations = [], isLoading: enrolledRecsLoading } = useQuery<Recommendation[]>({
    queryKey: ["/api/recommendations/enrolled-paths"],
    enabled: userPaths.length > 0,
  });

  const enrollMutation = useMutation({
    mutationFn: async (learningPathId: number) => {
      return apiRequest("POST", `/api/learning-paths/${learningPathId}/enroll`, {});
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



  // Generate proper duration formatting
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Generate unique tree structure for each learning path
  const generateTreeStructure = (path: LearningPath, userPath?: UserLearningPath): PathTreeNode[] => {
    const completedCourses = userPath?.completedCourses || [];
    
    // Different tree structures based on learning path type
    switch (path.title) {
      case "AI & Machine Learning Mastery":
        return [
          {
            id: 1, title: "Python Fundamentals", level: 1, 
            isCompleted: completedCourses.includes(1), isUnlocked: true, 
            prerequisites: [], children: [
              { id: 2, title: "Data Science Basics", level: 2, isCompleted: completedCourses.includes(2), isUnlocked: completedCourses.includes(1), prerequisites: [1], children: [] },
              { id: 3, title: "Statistics & Probability", level: 2, isCompleted: completedCourses.includes(3), isUnlocked: completedCourses.includes(1), prerequisites: [1], children: [] }
            ]
          },
          {
            id: 4, title: "Machine Learning", level: 2,
            isCompleted: completedCourses.includes(4), isUnlocked: completedCourses.includes(2) && completedCourses.includes(3),
            prerequisites: [2, 3], children: [
              { id: 5, title: "Deep Learning", level: 3, isCompleted: completedCourses.includes(5), isUnlocked: completedCourses.includes(4), prerequisites: [4], children: [] },
              { id: 6, title: "NLP Advanced", level: 3, isCompleted: completedCourses.includes(6), isUnlocked: completedCourses.includes(4), prerequisites: [4], children: [] }
            ]
          }
        ];
        
      case "Full-Stack Development Pro":
        return [
          {
            id: 7, title: "HTML/CSS/JS", level: 1,
            isCompleted: completedCourses.includes(7), isUnlocked: true,
            prerequisites: [], children: [
              { id: 8, title: "React Fundamentals", level: 2, isCompleted: completedCourses.includes(8), isUnlocked: completedCourses.includes(7), prerequisites: [7], children: [] },
              { id: 9, title: "Node.js Basics", level: 2, isCompleted: completedCourses.includes(9), isUnlocked: completedCourses.includes(7), prerequisites: [7], children: [] }
            ]
          },
          {
            id: 10, title: "Full-Stack Projects", level: 3,
            isCompleted: completedCourses.includes(10), isUnlocked: completedCourses.includes(8) && completedCourses.includes(9),
            prerequisites: [8, 9], children: [
              { id: 11, title: "Deployment & DevOps", level: 4, isCompleted: completedCourses.includes(11), isUnlocked: completedCourses.includes(10), prerequisites: [10], children: [] }
            ]
          }
        ];
        
      case "Business Leadership Excellence":
        return [
          {
            id: 12, title: "Management Basics", level: 1,
            isCompleted: completedCourses.includes(12), isUnlocked: true,
            prerequisites: [], children: [
              { id: 13, title: "Team Leadership", level: 2, isCompleted: completedCourses.includes(13), isUnlocked: completedCourses.includes(12), prerequisites: [12], children: [] },
              { id: 14, title: "Strategic Planning", level: 2, isCompleted: completedCourses.includes(14), isUnlocked: completedCourses.includes(12), prerequisites: [12], children: [] }
            ]
          },
          {
            id: 15, title: "Executive Skills", level: 3,
            isCompleted: completedCourses.includes(15), isUnlocked: completedCourses.includes(13) && completedCourses.includes(14),
            prerequisites: [13, 14], children: []
          }
        ];
        
      default:
        // Generic tree structure for other paths
        return [
          {
            id: 16, title: "Foundation", level: 1,
            isCompleted: completedCourses.includes(16), isUnlocked: true,
            prerequisites: [], children: [
              { id: 17, title: "Intermediate", level: 2, isCompleted: completedCourses.includes(17), isUnlocked: completedCourses.includes(16), prerequisites: [16], children: [] },
              { id: 18, title: "Advanced", level: 3, isCompleted: completedCourses.includes(18), isUnlocked: completedCourses.includes(17), prerequisites: [17], children: [] }
            ]
          }
        ];
    }
  };

  // Render tree node recursively
  const renderTreeNode = (node: PathTreeNode, depth = 0): JSX.Element => {
    const getNodeIcon = () => {
      if (node.isCompleted) return <CheckCircle className="w-5 h-5 text-slate-600" />;
      if (!node.isUnlocked) return <Lock className="w-5 h-5 text-gray-400" />;
      return <Play className="w-5 h-5 text-slate-600" />;
    };

    return (
      <motion.div
        key={node.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: depth * 0.1 }}
        className={`mb-2`}
        style={{ marginLeft: `${depth * 24}px` }}
      >
        <div className={`flex items-center p-3 rounded-lg border transition-all ${
          node.isCompleted ? 'bg-slate-50 border-slate-200 dark:bg-slate-900/20 dark:border-slate-800' :
          node.isUnlocked ? 'bg-slate-50 border-slate-200 dark:bg-slate-900/20 dark:border-slate-800 hover:shadow-md cursor-pointer' :
          'bg-cream-deep border-cream-deep dark:bg-gray-800 dark:border-gray-700'
        }`}>
          {getNodeIcon()}
          <div className="ml-3 flex-1">
            <div className="font-medium text-sm">{node.title}</div>
            <div className="text-xs text-gray-500">Level {node.level}</div>
          </div>
          {node.prerequisites.length > 0 && (
            <Badge variant="outline" className="text-xs">
              Requires: {node.prerequisites.length} course{node.prerequisites.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        
        {node.children.length > 0 && (
          <div className="ml-4 mt-2 pl-4 border-l-2 border-cream-deep dark:border-gray-700">
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </motion.div>
    );
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case "beginner":
        return "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200";
      case "intermediate":
        return "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200";
      case "advanced":
        return "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };



  return (
    <div className="min-h-screen bg-cream-soft dark:bg-black">
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
            {/* Skill Tree Visualization */}
            <div className="mb-8 p-6 bg-gradient-to-br from-slate-50 to-slate-50 dark:from-slate-950 dark:to-slate-950 rounded-lg border">
              <h2 className="text-2xl font-bold text-center mb-6 text-black dark:text-white">
                Interactive Skill Tree
              </h2>
              <div className="relative overflow-x-auto">
                <svg width="800" height="400" className="mx-auto">
                  {/* Connection lines */}
                  <defs>
                    <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#171717" />
                      <stop offset="100%" stopColor="#737373" />
                    </linearGradient>
                  </defs>
                  
                  {/* Skill tree paths */}
                  <motion.path
                    d="M150 200 L250 200 L350 150 L450 100"
                    stroke="url(#pathGradient)"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray="10,5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, delay: 0.5 }}
                  />
                  <motion.path
                    d="M150 200 L250 200 L350 250 L450 300"
                    stroke="url(#pathGradient)"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray="10,5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, delay: 1 }}
                  />
                  <motion.path
                    d="M450 100 L550 150 L650 200"
                    stroke="url(#pathGradient)"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray="10,5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, delay: 1.5 }}
                  />
                  
                  {/* Skill nodes */}
                  {[
                    { x: 150, y: 200, icon: "🎯", label: "Fundamentals", unlocked: true, level: 1 },
                    { x: 350, y: 150, icon: "🧠", label: "AI/ML", unlocked: true, level: 2 },
                    { x: 350, y: 250, icon: "💼", label: "Business", unlocked: true, level: 2 },
                    { x: 450, y: 100, icon: "🤖", label: "Advanced AI", unlocked: false, level: 3 },
                    { x: 450, y: 300, icon: "📊", label: "Analytics", unlocked: false, level: 3 },
                    { x: 650, y: 200, icon: "🏆", label: "Mastery", unlocked: false, level: 4 },
                  ].map((node, index) => (
                    <g key={index}>
                      <motion.circle
                        cx={node.x}
                        cy={node.y}
                        r="30"
                        fill={node.unlocked ? "#262626" : "#737373"}
                        stroke={node.unlocked ? "#0A0A0A" : "#525252"}
                        strokeWidth="3"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: index * 0.3, type: "spring", stiffness: 260, damping: 20 }}
                        className="cursor-pointer"
                      />
                      <motion.text
                        x={node.x}
                        y={node.y + 5}
                        textAnchor="middle"
                        fontSize="20"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.3 + 0.5 }}
                      >
                        {node.icon}
                      </motion.text>
                      <motion.text
                        x={node.x}
                        y={node.y + 50}
                        textAnchor="middle"
                        fontSize="12"
                        fill="currentColor"
                        className="font-medium"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.3 + 0.7 }}
                      >
                        {node.label}
                      </motion.text>
                      {!node.unlocked && (
                        <motion.g
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.3 + 1 }}
                        >
                          <circle cx={node.x + 20} cy={node.y - 20} r="8" fill="#262626" />
                          <text x={node.x + 20} y={node.y - 15} textAnchor="middle" fontSize="10" fill="white">🔒</text>
                        </motion.g>
                      )}
                    </g>
                  ))}
                </svg>
              </div>
              <div className="text-center mt-4 text-sm text-gray-600 dark:text-gray-400">
                Complete learning paths to unlock advanced skills and specializations
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pathsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse border-cream-deep dark:border-gray-800">
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
              ) : learningPaths.length > 0 ? (
                learningPaths.map((path: LearningPath, index: number) => {
                  const pathIcons: Record<string, any> = {
                    'AI & Machine Learning Mastery': Brain,
                    'Full-Stack Development Pro': Code,
                    'Business Leadership Excellence': Target,
                    'Data Science & Analytics': TrendingUp,
                    'Cybersecurity Specialist': Shield,
                  };
                  const IconComponent = pathIcons[path.title] || BookOpen;
                  
                  return (
                    <motion.div
                      key={path.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="border-cream-deep dark:border-gray-800 hover:shadow-lg transition-all duration-300 hover:scale-105">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-900">
                                <IconComponent className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                              </div>
                              <div>
                                <CardTitle className="text-lg text-black dark:text-white">
                                  {path.title}
                                </CardTitle>
                                <CardDescription className="text-gray-600 dark:text-gray-400 mt-1">
                                  {path.category?.name || 'Professional'}
                                </CardDescription>
                              </div>
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
                              {path.courseIds?.length || 0} courses
                            </div>
                          </div>

                          {path.tags && path.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {path.tags.slice(0, 3).map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <Button
                            onClick={() => enrollMutation.mutate(path.id)}
                            disabled={enrollMutation.isPending}
                            className="w-full bg-black text-white hover:bg-gray-800 dark:bg-cream-soft dark:text-black dark:hover:bg-gray-200 flex items-center gap-2"
                          >
                            <Play className="w-4 h-4" />
                            {enrollMutation.isPending ? "Enrolling..." : "Start Learning Path"}
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              ) : (
                <div className="col-span-full text-center py-12">
                  <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    No Learning Paths Available
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Check back soon for new learning paths
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="my-paths" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userPathsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="animate-pulse border-cream-deep dark:border-gray-800">
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
                    className="bg-black text-white hover:bg-gray-800 dark:bg-cream-soft dark:text-black dark:hover:bg-gray-200"
                  >
                    Explore Learning Paths
                  </Button>
                </div>
              ) : (
                userPaths.map((userPath: UserLearningPath) => {
                  const treeNodes = generateTreeStructure(userPath.learningPath, userPath);
                  
                  return (
                    <Card key={userPath.id} className="border-cream-deep dark:border-gray-800">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg text-black dark:text-white">
                              {userPath.learningPath.title}
                            </CardTitle>
                            <CardDescription className="text-gray-600 dark:text-gray-400 mt-1">
                              {userPath.learningPath.category?.name || 'Professional'}
                            </CardDescription>
                          </div>
                          {userPath.completedAt && (
                            <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200">
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

                        {/* Unique Tree View for this Learning Path */}
                        <div className="bg-cream-deep dark:bg-gray-900 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <TreePine className="w-4 h-4 text-slate-600" />
                            <span className="text-sm font-medium">Learning Path Tree</span>
                          </div>
                          <div className="space-y-1">
                            {treeNodes.map(node => renderTreeNode(node))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Trophy className="w-4 h-4" />
                            {userPath.completedCourses?.length || 0}/{userPath.learningPath.courseIds?.length || 0} completed
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDuration(userPath.learningPath.estimatedDuration)}
                          </div>
                        </div>

                        {/* Personalized Course Recommendations */}
                        {enrolledPathRecommendations.length > 0 && (
                          <div className="border-t pt-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Lightbulb className="w-4 h-4 text-slate-500" />
                              <span className="text-sm font-medium">Recommended for You</span>
                            </div>
                            <div className="space-y-2">
                              {enrolledPathRecommendations
                                .filter((rec: Recommendation) => rec.metadata?.categoryMatch || rec.score > '0.7')
                                .slice(0, 2)
                                .map((rec: Recommendation, idx: number) => (
                                <motion.div 
                                  key={idx}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: idx * 0.1 }}
                                  className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/20 rounded-lg"
                                >
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">{rec.course?.title || `Course ${rec.courseId}`}</div>
                                    <div className="text-xs text-gray-500">{rec.reason}</div>
                                  </div>
                                  <Badge variant="secondary" className="text-xs">
                                    {Math.round(parseFloat(rec.score) * 100)}% match
                                  </Badge>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}

                        <Button
                          className="w-full bg-black text-white hover:bg-gray-800 dark:bg-cream-soft dark:text-black dark:hover:bg-gray-200"
                        >
                          Continue Learning
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="recommendations" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendationsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse border-cream-deep dark:border-gray-800">
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
                  <Card key={index} className="border-cream-deep dark:border-gray-800">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg text-black dark:text-white">
                          Course Recommendation
                        </CardTitle>
                        <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200">
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
                            <CheckCircle className="w-4 h-4 text-slate-500" />
                            Category match
                          </div>
                        )}
                        {rec.metadata.skillLevelMatch && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-slate-500" />
                            Skill level match
                          </div>
                        )}
                        {rec.metadata.popularityScore && (
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-500" />
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
                  <Card key={i} className="animate-pulse border-cream-deep dark:border-gray-800">
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
                  <Card key={index} className="border-cream-deep dark:border-gray-800">
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
