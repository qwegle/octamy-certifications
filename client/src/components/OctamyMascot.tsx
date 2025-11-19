import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, Star, BookOpen, Trophy, Target, Lightbulb, Heart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface MascotMessage {
  id: string;
  type: 'welcome' | 'encouragement' | 'tip' | 'achievement' | 'guidance' | 'celebration';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  persistent?: boolean;
  autoHide?: number; // seconds
}

interface PremCqMascotProps {
  currentPage?: string;
  userProgress?: {
    coursesCompleted: number;
    totalCourses: number;
    streak: number;
    level: string;
  };
  onAction?: (action: string) => void;
}

const mascotExpressions = {
  happy: '😊',
  excited: '🤩',
  thinking: '🤔',
  celebrating: '🎉',
  encouraging: '💪',
  winking: '😉',
  studying: '📚',
  pointing: '👉',
  loving: '😍',
  wise: '🧠',
};

const mascotPersonalities = [
  {
    name: "Wise",
    color: "from-blue-500 to-purple-600",
    emoji: "🦉",
    messages: {
      welcome: "Welcome back, learner! Ready to expand your mind today?",
      encouragement: "Every expert was once a beginner. You're doing great!",
      tip: "Pro tip: Take breaks every 30 minutes to retain information better!",
      achievement: "Knowledge is power, and you're becoming more powerful!",
      guidance: "Let me guide you to the perfect learning path.",
    }
  },
  {
    name: "Energetic", 
    color: "from-orange-500 to-red-600",
    emoji: "🚀",
    messages: {
      welcome: "Hey there, superstar! Let's crush some learning goals today!",
      encouragement: "You're on fire! Keep that momentum going!",
      tip: "Challenge yourself with harder courses - that's where growth happens!",
      achievement: "Another win! You're unstoppable!",
      guidance: "Ready to level up? I know just the thing!",
    }
  },
  {
    name: "Gentle",
    color: "from-green-500 to-teal-600",
    emoji: "🌱", 
    messages: {
      welcome: "Hello, friend! Take your time and enjoy the learning journey.",
      encouragement: "Progress, not perfection. You're exactly where you need to be.",
      tip: "Remember to celebrate small wins - they add up to big achievements!",
      achievement: "Look how much you've grown! I'm so proud of you.",
      guidance: "Let's find something that sparks your curiosity.",
    }
  }
];

const contextualMessages = {
  landing: [
    "Ready to start your learning adventure? I'm here to help!",
    "Welcome to PremCq! Your journey to expertise begins now.",
    "Every master was once a disaster. Let's start building your skills!"
  ],
  courses: [
    "So many exciting courses! Which one calls to you?",
    "Each course is a doorway to new possibilities.",
    "Pick something that makes you curious - curiosity is the best teacher!"
  ],
  exam: [
    "You've prepared well. Trust yourself and breathe deeply.",
    "Remember: this is just a checkpoint, not the destination.",
    "You've got this! Show that exam what you're made of!"
  ],
  checkout: [
    "Investing in yourself is the best investment you can make!",
    "You're about to unlock new skills and opportunities!",
    "Smart choice! Your future self will thank you."
  ],
  dashboard: [
    "Look at your progress! Every step forward matters.",
    "Your learning journey is unique and valuable.",
    "Ready for the next chapter of your growth story?"
  ]
};

export default function PremCqMascot({ currentPage = 'landing', userProgress, onAction }: PremCqMascotProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<MascotMessage | null>(null);
  const [mascotPersonality, setMascotPersonality] = useState(mascotPersonalities[0]);
  const [expression, setExpression] = useState(mascotExpressions.happy);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showTip, setShowTip] = useState(false);

  // Initialize mascot based on user preferences
  useEffect(() => {
    const savedPersonality = localStorage.getItem('premcq-mascot-personality');
    if (savedPersonality) {
      const personality = mascotPersonalities.find(p => p.name === savedPersonality);
      if (personality) setMascotPersonality(personality);
    } else {
      // Random personality on first visit
      const randomPersonality = mascotPersonalities[Math.floor(Math.random() * mascotPersonalities.length)];
      setMascotPersonality(randomPersonality);
      localStorage.setItem('premcq-mascot-personality', randomPersonality.name);
    }

    // Show mascot after page load
    const timer = setTimeout(() => setIsVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Generate contextual messages based on current page and progress
  useEffect(() => {
    if (!isVisible) return;

    const generateMessage = (): MascotMessage | null => {
      const pageMessages = contextualMessages[currentPage as keyof typeof contextualMessages];
      const randomMessage = pageMessages ? pageMessages[Math.floor(Math.random() * pageMessages.length)] : null;

      switch (currentPage) {
        case 'landing':
          return {
            id: 'welcome',
            type: 'welcome',
            title: 'Welcome to PremCq!',
            message: randomMessage || mascotPersonality.messages.welcome,
            action: {
              label: 'Explore Courses',
              onClick: () => onAction?.('explore-courses')
            }
          };

        case 'courses':
          return {
            id: 'courses-guide',
            type: 'guidance',
            title: 'Choose Your Path',
            message: randomMessage || "Pick a course that excites you! Each one is designed to build real skills.",
            action: {
              label: 'Show My Level',
              onClick: () => onAction?.('show-level')
            }
          };

        case 'exam':
          return {
            id: 'exam-encouragement',
            type: 'encouragement', 
            title: 'You Got This!',
            message: randomMessage || "Take a deep breath and trust your preparation. You're ready!",
            persistent: true
          };

        case 'checkout':
          return {
            id: 'checkout-help',
            type: 'guidance',
            title: 'Great Choice!',
            message: randomMessage || "You're investing in yourself - that's always worth it!",
            autoHide: 6
          };

        case 'dashboard':
          if (userProgress) {
            if (userProgress.coursesCompleted === 0) {
              return {
                id: 'first-course',
                type: 'guidance',
                title: 'Start Your Journey',
                message: "Ready for your first course? I believe in you!",
                action: {
                  label: 'Browse Courses',
                  onClick: () => onAction?.('browse-courses')
                }
              };
            } else if (userProgress.streak > 5) {
              return {
                id: 'streak-celebration',
                type: 'celebration',
                title: 'Amazing Streak!',
                message: `${userProgress.streak} days in a row! You're building a powerful learning habit!`,
                autoHide: 8
              };
            } else if (userProgress.coursesCompleted > 0) {
              return {
                id: 'progress-encouragement',
                type: 'achievement',
                title: 'Keep Growing!',
                message: `${userProgress.coursesCompleted} courses completed! Your dedication is inspiring.`,
                action: {
                  label: 'Next Course',
                  onClick: () => onAction?.('next-course')
                }
              };
            }
          }
          return {
            id: 'dashboard-default',
            type: 'guidance',
            title: 'Your Learning Hub',
            message: randomMessage || "This is your command center. What would you like to learn today?",
            autoHide: 5
          };

        default:
          // Show random tips occasionally
          if (Math.random() < 0.25 && !showTip) {
            setShowTip(true);
            const tips = [
              "Did you know? Active recall is more effective than re-reading!",
              "Try teaching someone else what you've learned - it reinforces your knowledge!",
              "Setting small, achievable goals keeps motivation high!",
              "Taking notes by hand can improve memory retention!",
              "Regular practice sessions beat cramming every time!"
            ];
            return {
              id: 'random-tip',
              type: 'tip',
              title: 'Learning Tip',
              message: tips[Math.floor(Math.random() * tips.length)],
              autoHide: 12
            };
          }
      }
      return null;
    };

    const message = generateMessage();
    if (message) {
      setCurrentMessage(message);
      
      // Update expression based on message type
      switch (message.type) {
        case 'welcome':
          setExpression(mascotExpressions.winking);
          break;
        case 'encouragement':
          setExpression(mascotExpressions.encouraging);
          break;
        case 'celebration':
          setExpression(mascotExpressions.celebrating);
          break;
        case 'achievement':
          setExpression(mascotExpressions.excited);
          break;
        case 'tip':
          setExpression(mascotExpressions.wise);
          break;
        case 'guidance':
          setExpression(mascotExpressions.pointing);
          break;
        default:
          setExpression(mascotExpressions.happy);
      }

      // Auto-hide if specified
      if (message.autoHide) {
        setTimeout(() => {
          setCurrentMessage(null);
          setExpression(mascotExpressions.happy);
          if (message.id === 'random-tip') setShowTip(false);
        }, message.autoHide * 1000);
      }
    }
  }, [currentPage, userProgress, mascotPersonality, isVisible, showTip]);

  const handleDismiss = () => {
    setCurrentMessage(null);
    setExpression(mascotExpressions.happy);
    if (currentMessage?.id === 'random-tip') setShowTip(false);
  };

  const handlePersonalityChange = () => {
    setIsAnimating(true);
    
    const currentIndex = mascotPersonalities.findIndex(p => p.name === mascotPersonality.name);
    const nextIndex = (currentIndex + 1) % mascotPersonalities.length;
    const newPersonality = mascotPersonalities[nextIndex];
    
    setMascotPersonality(newPersonality);
    localStorage.setItem('premcq-mascot-personality', newPersonality.name);
    
    setExpression(mascotExpressions.excited);
    
    // Show personality change message
    setCurrentMessage({
      id: 'personality-change',
      type: 'welcome',
      title: `I'm ${newPersonality.name} now!`,
      message: newPersonality.messages.welcome,
      autoHide: 4
    });
    
    setTimeout(() => {
      setExpression(mascotExpressions.happy);
      setIsAnimating(false);
    }, 2000);
  };

  const handleMascotClick = () => {
    if (currentMessage) {
      handleDismiss();
    } else {
      // Show a random encouraging message
      const encouragements = [
        "You're doing amazing! Keep up the great work!",
        "Every step forward is progress. I'm proud of you!",
        "Learning is a journey, not a destination. Enjoy the ride!",
        "Your curiosity and dedication inspire me!",
        "Remember: growth happens outside your comfort zone!"
      ];
      
      setCurrentMessage({
        id: 'click-encouragement',
        type: 'encouragement',
        title: 'Just a Reminder',
        message: encouragements[Math.floor(Math.random() * encouragements.length)],
        autoHide: 5
      });
      
      setExpression(mascotExpressions.loving);
      setTimeout(() => setExpression(mascotExpressions.happy), 3000);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {currentMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            className="mb-4 mr-2"
          >
            <Card className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 shadow-xl max-w-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {currentMessage.type === 'welcome' && <Star className="w-3 h-3 mr-1" />}
                      {currentMessage.type === 'encouragement' && <Heart className="w-3 h-3 mr-1" />}
                      {currentMessage.type === 'tip' && <Lightbulb className="w-3 h-3 mr-1" />}
                      {currentMessage.type === 'guidance' && <Target className="w-3 h-3 mr-1" />}
                      {currentMessage.type === 'celebration' && <Trophy className="w-3 h-3 mr-1" />}
                      {currentMessage.type === 'achievement' && <Trophy className="w-3 h-3 mr-1" />}
                      {currentMessage.title}
                    </Badge>
                  </div>
                  {!currentMessage.persistent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDismiss}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  {currentMessage.message}
                </p>
                
                {currentMessage.action && (
                  <Button
                    size="sm"
                    onClick={currentMessage.action.onClick}
                    className="w-full"
                  >
                    {currentMessage.action.label}
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mascot Avatar */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ 
          scale: 1, 
          rotate: 0,
          y: isAnimating ? [-5, 5, -5] : 0 
        }}
        whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
        whileTap={{ scale: 0.9 }}
        transition={{
          type: "spring",
          damping: 15,
          stiffness: 300,
          y: { repeat: isAnimating ? Infinity : 0, duration: 0.5 }
        }}
        className="relative cursor-pointer"
        onClick={handleMascotClick}
        onDoubleClick={handlePersonalityChange}
      >
        <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${mascotPersonality.color} shadow-lg flex items-center justify-center border-4 border-white dark:border-gray-800 relative overflow-hidden`}>
          <span className="text-2xl z-10" role="img" aria-label="mascot expression">
            {expression}
          </span>
          
          {/* Animated background pattern */}
          <motion.div
            className="absolute inset-0 opacity-10"
            animate={{
              backgroundPosition: ["0% 0%", "100% 100%"],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              repeatType: "reverse",
            }}
            style={{
              backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
              backgroundSize: "8px 8px",
            }}
          />
        </div>
        
        {/* Pulse animation for attention */}
        <motion.div
          className={`absolute inset-0 rounded-full bg-gradient-to-br ${mascotPersonality.color} opacity-30`}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            repeatDelay: 7,
          }}
        />
        
        {/* Chat indicator */}
        {currentMessage && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center"
          >
            <MessageCircle className="w-3 h-3 text-white" />
          </motion.div>
        )}
        
        {/* Personality indicator */}
        <motion.div 
          className="absolute -bottom-1 left-1/2 transform -translate-x-1/2"
          whileHover={{ scale: 1.1 }}
        >
          <Badge variant="outline" className="text-xs px-1 py-0.5 bg-white dark:bg-gray-800 border-2">
            <span className="mr-1">{mascotPersonality.emoji}</span>
            {mascotPersonality.name}
          </Badge>
        </motion.div>
        
        {/* Hover tooltip */}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
          <div className="bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap">
            Click me! Double-click to change personality
          </div>
        </div>
      </motion.div>
    </div>
  );
}