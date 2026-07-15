import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  RotateCcw,
  TrendingUp,
  BookOpen,
  Clock,
  Target,
  Star,
  ArrowRight,
  Brain,
  Lightbulb
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ExamResult {
  examAttemptId: number;
  score: number;
  passed: boolean;
  courseId: number;
  courseTitle: string;
  passingScore: number;
  totalQuestions: number;
  correctAnswers: number;
  timeTaken: number;
  submittedAt: string;
  retakeCount: number;
  questionAnalysis: {
    categoryBreakdown: {
      category: string;
      correct: number;
      total: number;
      percentage: number;
    }[];
    difficultyBreakdown: {
      level: string;
      correct: number;
      total: number;
      percentage: number;
    }[];
    weakAreas: string[];
    recommendations: string[];
  };
}

interface Course {
  id: number;
  title: string;
  price: string;
  duration: number;
  level: string;
  description: string;
}

export default function ExamResults() {
  const [, params] = useRoute("/exam-results/:examAttemptId");
  const [, setLocation] = useLocation();
  const examAttemptId = params?.examAttemptId;

  const { data: examResult, isLoading } = useQuery<ExamResult>({
    queryKey: [`/api/exam-results/${examAttemptId}`],
    enabled: !!examAttemptId,
  });

  const { data: course } = useQuery<Course & { slug?: string }>({
    queryKey: [`/api/courses/${examResult?.courseId}`],
    enabled: !!examResult?.courseId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-soft dark:bg-black flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-black dark:border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!examResult) {
    return (
      <div className="min-h-screen bg-cream-soft dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black dark:text-white mb-4">
            Exam Results Not Found
          </h1>
          <Button onClick={() => setLocation("/")}>
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  const getGradeColor = (score: number, passingScore: number) => {
    if (score >= passingScore) return "text-green-600";
    if (score >= passingScore * 0.8) return "text-yellow-600";
    return "text-red-600";
  };

  const getGradeLetter = (score: number) => {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const handleRetakeExam = () => {
    setLocation(`/payment?courseId=${examResult.courseId}&type=retake&previousAttempt=${examAttemptId}`);
  };

  const handleStudyMore = () => {
    setLocation(course?.slug ? `/get-certified/${course.slug}` : "/get-certified");
  };

  return (
    <div className="min-h-screen bg-cream-soft dark:bg-black">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="mb-4">
            {examResult.passed ? (
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            ) : (
              <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            )}
          </div>
          <h1 className="text-4xl font-bold text-black dark:text-white mb-2">
            {examResult.passed ? "Congratulations!" : "Exam Not Passed"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            {examResult.passed 
              ? "You have successfully passed the exam"
              : "Don't worry, you can retake the exam and improve your score"
            }
          </p>
        </motion.div>

        {/* Score Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="mb-6 border-cream-deep dark:border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                <Target className="w-5 h-5" />
                Exam Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className={`text-6xl font-bold ${getGradeColor(examResult.score, examResult.passingScore)}`}>
                    {examResult.score}%
                  </div>
                  <div className="text-gray-600 dark:text-gray-400 mt-2">
                    Grade: {getGradeLetter(examResult.score)}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600 dark:text-gray-400">Required Score</span>
                      <span className="text-black dark:text-white font-medium">{examResult.passingScore}%</span>
                    </div>
                    <Progress value={examResult.passingScore} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600 dark:text-gray-400">Your Score</span>
                      <span className="text-black dark:text-white font-medium">{examResult.score}%</span>
                    </div>
                    <Progress value={examResult.score} className="h-2" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Correct Answers</span>
                    <span className="text-black dark:text-white font-medium">
                      {examResult.correctAnswers}/{examResult.totalQuestions}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Time Taken</span>
                    <span className="text-black dark:text-white font-medium">
                      {formatTime(examResult.timeTaken)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Attempt</span>
                    <span className="text-black dark:text-white font-medium">
                      #{examResult.retakeCount + 1}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Detailed Analysis - Only show for failed exams */}
        {!examResult.passed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"
          >
            {/* Category Breakdown */}
            <Card className="border-cream-deep dark:border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                  <Brain className="w-5 h-5" />
                  Performance by Category
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {examResult.questionAnalysis.categoryBreakdown.map((category, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{category.category}</span>
                      <span className="text-black dark:text-white font-medium">
                        {category.correct}/{category.total} ({category.percentage}%)
                      </span>
                    </div>
                    <Progress value={category.percentage} className="h-2" />
                    {category.percentage < 60 && (
                      <div className="flex items-center gap-1 text-red-600 text-sm">
                        <AlertTriangle className="w-3 h-3" />
                        Needs improvement
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Difficulty Breakdown */}
            <Card className="border-cream-deep dark:border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                  <TrendingUp className="w-5 h-5" />
                  Performance by Difficulty
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {examResult.questionAnalysis.difficultyBreakdown.map((difficulty, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400 capitalize">{difficulty.level}</span>
                      <span className="text-black dark:text-white font-medium">
                        {difficulty.correct}/{difficulty.total} ({difficulty.percentage}%)
                      </span>
                    </div>
                    <Progress value={difficulty.percentage} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Recommendations and Weak Areas */}
        {!examResult.passed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"
          >
            {/* Weak Areas */}
            <Card className="border-cream-deep dark:border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Areas to Improve
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {examResult.questionAnalysis.weakAreas.map((area, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span className="text-red-700 dark:text-red-300">{area}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Study Recommendations */}
            <Card className="border-cream-deep dark:border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                  <Lightbulb className="w-5 h-5 text-yellow-600" />
                  Study Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {examResult.questionAnalysis.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Star className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span className="text-blue-700 dark:text-blue-300 text-sm">{recommendation}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          {!examResult.passed ? (
            <>
              <Button
                onClick={handleRetakeExam}
                className="bg-black text-white hover:bg-gray-800 dark:bg-cream-soft dark:text-black dark:hover:bg-gray-200 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Retake Exam - Pay ₹{course?.price || "99"}
              </Button>
              <Button
                variant="outline"
                onClick={handleStudyMore}
                className="flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Study Course Material
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setLocation(`/payment?courseId=${examResult.courseId}&type=certificate`)}
              className="bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              Get Your Certificate - ₹{course?.price || "99"}
            </Button>
          )}
        </motion.div>

        {/* Course Information */}
        {course && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8"
          >
            <Card className="border-cream-deep dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-black dark:text-white">Course Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h3 className="font-medium text-black dark:text-white mb-1">{course.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{course.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">{course.duration} minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {course.level}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
