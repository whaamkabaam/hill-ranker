import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import confetti from 'canvas-confetti';

interface ProgressGamificationProps {
  completed: number;
  total: number;
  showConfetti?: boolean;
}

export default function ProgressGamification({
  completed,
  total,
  showConfetti = false,
}: ProgressGamificationProps) {
  const [hasShownConfetti, setHasShownConfetti] = useState(false);
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  useEffect(() => {
    if (showConfetti && percentage === 100 && !hasShownConfetti) {
      triggerConfetti();
      setHasShownConfetti(true);
    }
  }, [percentage, showConfetti, hasShownConfetti]);

  const triggerConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['hsl(var(--primary))', 'hsl(var(--accent))', '#FFD700'],
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['hsl(var(--primary))', 'hsl(var(--accent))', '#FFD700'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {completed} / {total} comparisons
        </span>
        <span className="text-sm text-muted-foreground">{percentage.toFixed(0)}%</span>
      </div>
      
      <Progress value={percentage} className="h-2 animate-fade-in" />

      {percentage === 100 && (
        <div className="text-center animate-scale-in">
          <p className="text-sm font-medium text-primary">
            🎉 All comparisons completed! Ready to submit your rankings.
          </p>
        </div>
      )}
    </div>
  );
}
