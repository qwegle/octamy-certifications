import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

interface ExamTimerProps {
  duration: number; // in minutes
  onTimeUp: () => void;
  startedAtMs?: number;
}

export default function ExamTimer({ duration, onTimeUp, startedAtMs }: ExamTimerProps) {
  const calculateTimeLeft = () => Math.max(
    0,
    duration * 60 - Math.floor((Date.now() - (startedAtMs || Date.now())) / 1000),
  );
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);
  const firedRef = useRef(false);
  const onTimeUpRef = useRef(onTimeUp);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  useEffect(() => {
    firedRef.current = false;
    const tick = () => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        onTimeUpRef.current();
      }
    };
    tick();
    const timer = setInterval(() => {
      tick();
    }, 1000);

    return () => clearInterval(timer);
  }, [duration, startedAtMs]);

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
