import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface ExamTimerProps {
  duration: number; // in minutes
  onTimeUp: () => void;
}

export default function ExamTimer({ duration, onTimeUp }: ExamTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration * 60); // convert to seconds

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onTimeUp]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isWarning = timeLeft <= 300; // 5 minutes warning
  const isCritical = timeLeft <= 60; // 1 minute critical

  return (
    <div className={`flex items-center px-4 py-2 rounded-lg ${
      isCritical ? 'bg-red-100 text-red-800' : 
      isWarning ? 'bg-yellow-100 text-yellow-800' : 
      'bg-octamy-gray-100 text-octamy-black'
    }`}>
      <Clock className="w-4 h-4 mr-2" />
      <span className="font-semibold">{formatTime(timeLeft)}</span>
    </div>
  );
}
