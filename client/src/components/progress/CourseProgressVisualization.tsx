import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy, Star, Target, Zap, Book, Award } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface Achievement {
  id: number;
  name: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  tier: string;
  points: number;
  rarity: string;
}

interface UserAchievement {
  id: number;
  achievementId: number;
  unlockedAt: string;
  progress: number;
  isViewed: boolean;
  achievement?: Achievement;
}

interface CourseProgress {
  id: number;
  courseId: number;
  status: string;
  progressPercentage: number;
  timeSpent: number;
  bestScore: number;
  attemptCount: number;
  streakDays: number;
}

interface Course {
  id: number;
  title: string;
  description: string;
  level: string;
  duration: number;
  categoryId: number;
  category: {
    name: string;
    icon: string;
  };
}

interface Props {
  courseId?: number;
  userId?: number;
}

export function CourseProgressVisualization({ courseId, userId }: Props) {
  const [newAchievements, setNewAchievements] = useState<UserAchievement[]>([]);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: progress = [] } = useQuery<CourseProgress[]>({
    queryKey: ['progress', courseId],
    queryFn: () => apiRequest(`/api/progress${courseId ? `?courseId=${courseId}` : ''}`),
    enabled: !!userId
  });

  const { data: achievements = [] } = useQuery<UserAchievement[]>({
    queryKey: ['user-achievements'],
    queryFn: () => apiRequest('/api/user/achievements?details=true'),
    enabled: !!userId
  });

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ['courses'],
    queryFn: () => apiRequest('/api/courses')
  });

  const checkAchievementsMutation = useMutation({
    mutationFn: (data: { courseId?: number }) => 
      apiRequest('/api/achievements/check', { method: 'POST', body: data }),
    onSuccess: (newUnlocks: UserAchievement[]) => {
      if (newUnlocks.length > 0) {
        setNewAchievements(newUnlocks);
        setShowAchievementModal(true);
        queryClient.invalidateQueries({ queryKey: ['user-achievements'] });
      }
    }
  });

  const updateProgressMutation = useMutation({
    mutationFn: (data: Partial<CourseProgress>) => 
      apiRequest('/api/progress', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      if (courseId) {
        checkAchievementsMutation.mutate({ courseId });
      }
    }
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return 'from-amber-600 to-amber-800';
      case 'silver': return 'from-gray-400 to-gray-600';
      case 'gold': return 'from-yellow-400 to-yellow-600';
      case 'platinum': return 'from-gray-300 to-gray-500';
      case 'diamond': return 'from-blue-400 to-blue-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const getRarityGlow = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'shadow-md';
      case 'rare': return 'shadow-lg shadow-blue-500/25';
      case 'epic': return 'shadow-xl shadow-purple-500/30';
      case 'legendary': return 'shadow-2xl shadow-yellow-500/40';
      default: return 'shadow-md';
    }
  };

  const getIconComponent = (iconName: string) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      '🎯': <Target className="w-8 h-8" />,
      '💯': <Star className="w-8 h-8" />,
      '⭐': <Star className="w-8 h-8" />,
      '🏆': <Trophy className="w-8 h-8" />,
      '⚡': <Zap className="w-8 h-8" />,
      '📚': <Book className="w-8 h-8" />
    };
    return iconMap[iconName] || <Award className="w-8 h-8" />;
  };

  const CircularProgress = ({ 
    percentage, 
    size = 120, 
    strokeWidth = 8,
    className = ''
  }: { 
    percentage: number; 
    size?: number; 
    strokeWidth?: number;
    className?: string;
  }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
      <div className={`relative ${className}`}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-white/10"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#gradient)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#f4e09d" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-white">
            {percentage}%
          </span>
        </div>
      </div>
    );
  };

  const AchievementCard = ({ achievement }: { achievement: UserAchievement }) => (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      exit={{ scale: 0, rotate: 180 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={`relative bg-gradient-to-br ${getTierColor(achievement.achievement?.tier || 'bronze')} 
        p-6 rounded-xl text-white ${getRarityGlow(achievement.achievement?.rarity || 'common')}`}
    >
      <div className="absolute inset-0 bg-black/20 rounded-xl" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-white/20 rounded-full">
            {getIconComponent(achievement.achievement?.icon || '🏆')}
          </div>
          <div className="text-xs bg-white/20 px-2 py-1 rounded-full">
            {achievement.achievement?.tier?.toUpperCase()}
          </div>
        </div>
        <h3 className="font-bold text-lg mb-2">{achievement.achievement?.title}</h3>
        <p className="text-sm opacity-90 mb-3">{achievement.achievement?.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs">+{achievement.achievement?.points} XP</span>
          <span className="text-xs capitalize">{achievement.achievement?.rarity}</span>
        </div>
      </div>
    </motion.div>
  );

  const CourseProgressCard = ({ courseProgress, course }: { 
    courseProgress: CourseProgress; 
    course: Course;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black border border-white/10 rounded-xl p-6 text-white"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-lg">{course.title}</h3>
          <p className="text-sm text-gray-400 capitalize">{courseProgress.status.replace('_', ' ')}</p>
        </div>
        <div className="text-2xl">{course.category.icon}</div>
      </div>

      <div className="flex items-center justify-center mb-6">
        <CircularProgress percentage={courseProgress.progressPercentage} />
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-gray-400">Best Score</div>
          <div className="font-bold text-xl">{courseProgress.bestScore}%</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-gray-400">Attempts</div>
          <div className="font-bold text-xl">{courseProgress.attemptCount}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-gray-400">Time Spent</div>
          <div className="font-bold text-xl">{Math.floor(courseProgress.timeSpent / 60)}h</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-gray-400">Streak</div>
          <div className="font-bold text-xl">{courseProgress.streakDays}d</div>
        </div>
      </div>

      {courseProgress.status === 'completed' && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="mt-4 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg text-center font-semibold"
        >
          ✓ Completed
        </motion.div>
      )}
    </motion.div>
  );

  return (
    <div className="space-y-8">
      {/* Achievement Modal */}
      <AnimatePresence>
        {showAchievementModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAchievementModal(false)}
          >
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 50 }}
              className="bg-black border border-white/20 rounded-2xl p-8 max-w-2xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-8">
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0]
                  }}
                  transition={{ 
                    duration: 0.6,
                    repeat: Infinity,
                    repeatDelay: 2
                  }}
                  className="text-6xl mb-4"
                >
                  🎉
                </motion.div>
                <h2 className="text-3xl font-bold text-white mb-2">Achievement Unlocked!</h2>
                <p className="text-gray-400">You've earned new achievements</p>
              </div>

              <div className="grid gap-4 mb-8">
                {newAchievements.map((achievement, index) => (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.2 }}
                  >
                    <AchievementCard achievement={achievement} />
                  </motion.div>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAchievementModal(false)}
                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold py-3 rounded-lg"
              >
                Continue Learning
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Overview */}
      <div className="grid gap-6">
        {courseId ? (
          // Single course view
          progress
            .filter(p => p.courseId === courseId)
            .map(courseProgress => {
              const course = courses.find(c => c.id === courseProgress.courseId);
              return course ? (
                <CourseProgressCard 
                  key={courseProgress.id} 
                  courseProgress={courseProgress} 
                  course={course} 
                />
              ) : null;
            })
        ) : (
          // All courses view
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {progress.map(courseProgress => {
              const course = courses.find(c => c.id === courseProgress.courseId);
              return course ? (
                <CourseProgressCard 
                  key={courseProgress.id} 
                  courseProgress={courseProgress} 
                  course={course} 
                />
              ) : null;
            })}
          </div>
        )}
      </div>

      {/* Achievements Gallery */}
      <div className="bg-black border border-white/10 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-6">Your Achievements</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map(achievement => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </div>
        {achievements.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No achievements yet. Complete courses to unlock your first achievement!</p>
          </div>
        )}
      </div>
    </div>
  );
}