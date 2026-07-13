import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trophy, Star, Clock, Target, Zap, Award, BookOpen, TrendingUp } from 'lucide-react';
import { 
  UserCourseProgress, 
  UserAchievement, 
  Achievement, 
  Course 
} from '@shared/schema';

interface Props {
  courseId?: number;
  userId?: number;
}

type UserAchievementWithDetails = UserAchievement & { achievement?: Achievement | null };

export function CourseProgressVisualization({ courseId, userId }: Props) {
  const [newAchievements, setNewAchievements] = useState<UserAchievementWithDetails[]>([]);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(courseId || null);

  // Fetch course progress data
  const { data: progressData = [], isLoading: progressLoading } = useQuery<UserCourseProgress[]>({
    queryKey: ['/api/progress'],
  });

  // Fetch user achievements
  const { data: achievementsData = [], isLoading: achievementsLoading } = useQuery<UserAchievementWithDetails[]>({
    queryKey: ['/api/user/achievements'],
  });

  // Fetch courses data
  const { data: coursesData = [], isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ['/api/courses'],
  });

  // Check for new achievements mutation
  const checkAchievements = useMutation<UserAchievementWithDetails[], Error, { courseId?: number }>({
    mutationFn: async (data) => {
      const response = await apiRequest('POST', '/api/achievements/check', data);
      return response.json();
    },
    onSuccess: (newAchievements) => {
      if (newAchievements && newAchievements.length > 0) {
        setNewAchievements(newAchievements);
        setShowAchievementModal(true);
        queryClient.invalidateQueries({ queryKey: ['/api/user/achievements'] });
      }
    },
  });

  // Check for achievements when progress updates
  useEffect(() => {
    if (selectedCourse) {
      checkAchievements.mutate({ courseId: selectedCourse });
    }
  }, [selectedCourse]);

  const isLoading = progressLoading || achievementsLoading || coursesLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Filter progress data by course if specified
  const filteredProgress = courseId 
    ? (progressData as UserCourseProgress[]).filter(p => p.courseId === courseId)
    : progressData as UserCourseProgress[];

  // Find course data for each progress entry
  const progressWithCourses = filteredProgress.map(courseProgress => {
    const course = (coursesData as Course[]).find(c => c.id === courseProgress.courseId);
    return { ...courseProgress, course };
  });

  // Get recent achievements (last 5)
  const recentAchievements = achievementsData.map(achievement => {
    const achievementDetails = achievement.achievement;
    return { ...achievement, achievement: achievementDetails };
  }).slice(0, 5);

  const AchievementCard = ({ achievement }: { achievement: UserAchievementWithDetails }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      <Card className="border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-900/20 dark:to-amber-900/20">
        <CardContent className="p-4 text-center">
          <div className="text-4xl mb-2">{achievement.achievement?.icon || '🏆'}</div>
          <h3 className="font-bold text-lg mb-1">{achievement.achievement?.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {achievement.achievement?.description}
          </p>
          <Badge 
            variant="secondary" 
            className={`${
              achievement.achievement?.rarity === 'legendary' ? 'bg-purple-500 text-white' :
              achievement.achievement?.rarity === 'epic' ? 'bg-orange-500 text-white' :
              achievement.achievement?.rarity === 'rare' ? 'bg-blue-500 text-white' :
              'bg-gray-500 text-white'
            }`}
          >
            {achievement.achievement?.rarity || 'common'}
          </Badge>
          <div className="mt-2 text-sm font-medium">
            +{achievement.achievement?.points || 10} points
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const ProgressCard = ({ courseProgress, course }: { courseProgress: UserCourseProgress; course?: Course }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5" />
            {course?.title || 'Course'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Progress</span>
              <span className="font-medium">{courseProgress.progressPercentage}%</span>
            </div>
            <Progress value={courseProgress.progressPercentage} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <div>
                <div className="font-medium">{Math.floor(courseProgress.timeSpent / 60)}h {courseProgress.timeSpent % 60}m</div>
                <div className="text-gray-500">Time Spent</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-green-500" />
              <div>
                <div className="font-medium">{courseProgress.bestScore || 0}%</div>
                <div className="text-gray-500">Best Score</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              <div>
                <div className="font-medium">{courseProgress.streakDays || 0} days</div>
                <div className="text-gray-500">Streak</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <div>
                <div className="font-medium">{courseProgress.attemptCount || 0}</div>
                <div className="text-gray-500">Attempts</div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Badge 
              variant={courseProgress.status === 'completed' ? 'default' : 'secondary'}
              className="capitalize"
            >
              {courseProgress.status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="space-y-8">
      {/* Recent Achievements Section */}
      {recentAchievements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/10 dark:to-amber-900/10 border-yellow-200 dark:border-yellow-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-600" />
                Recent Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {recentAchievements.map((achievement) => (
                  <motion.div
                    key={achievement.id}
                    whileHover={{ scale: 1.05 }}
                    className="text-center p-3 rounded-lg bg-white dark:bg-gray-800 shadow-sm"
                  >
                    <div className="text-2xl mb-1">{achievement.achievement?.icon || '🏆'}</div>
                    <div className="text-xs font-medium truncate">{achievement.achievement?.title}</div>
                    <div className="text-xs text-gray-500">+{achievement.achievement?.points || 10} pts</div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Course Progress Grid */}
      <div>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Course Progress
        </h2>
        
        {progressWithCourses.length === 0 ? (
          <Card className="p-8 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
              No Progress Yet
            </h3>
            <p className="text-gray-500">
              Start taking courses to see your progress here!
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {progressWithCourses.map((item) => (
              <ProgressCard 
                key={item.id} 
                courseProgress={item} 
                course={item.course} 
              />
            ))}
          </div>
        )}
      </div>

      {/* Achievement Unlock Modal */}
      <AnimatePresence>
        {showAchievementModal && (
          <Dialog open={showAchievementModal} onOpenChange={setShowAchievementModal}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-center text-2xl font-bold text-yellow-600">
                  🎉 Achievement Unlocked!
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {newAchievements.map((achievement, index) => (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ 
                      duration: 0.8,
                      delay: index * 0.2,
                      type: "spring",
                      stiffness: 200 
                    }}
                    className="text-center p-6 bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-lg border-2 border-yellow-400"
                  >
                    <motion.div
                      animate={{ 
                        scale: [1, 1.2, 1],
                        rotate: [0, 5, -5, 0] 
                      }}
                      transition={{ 
                        duration: 2,
                        repeat: Infinity,
                        repeatType: "reverse" 
                      }}
                      className="text-6xl mb-4"
                    >
                      {achievement.achievement?.icon || '🏆'}
                    </motion.div>
                    <h3 className="text-xl font-bold mb-2">{achievement.achievement?.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {achievement.achievement?.description}
                    </p>
                    <Badge 
                      className={`${
                        achievement.achievement?.rarity === 'legendary' ? 'bg-purple-500' :
                        achievement.achievement?.rarity === 'epic' ? 'bg-orange-500' :
                        achievement.achievement?.rarity === 'rare' ? 'bg-blue-500' :
                        'bg-gray-500'
                      } text-white px-3 py-1`}
                    >
                      {achievement.achievement?.rarity || 'common'}
                    </Badge>
                    <div className="mt-3 text-lg font-bold text-yellow-600">
                      +{achievement.achievement?.points || 10} Points!
                    </div>
                  </motion.div>
                ))}
                <Button 
                  onClick={() => setShowAchievementModal(false)}
                  className="w-full mt-6 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600"
                >
                  Awesome! 🎉
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
