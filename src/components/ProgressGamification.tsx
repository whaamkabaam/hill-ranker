import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Trophy, Zap, Target, Award } from 'lucide-react';
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

  const getMilestone = () => {
    if (percentage === 100) return { icon: Trophy, text: 'Complete!', color: 'text-yellow-500' };
    if (percentage >= 75) return { icon: Award, text: 'Almost there!', color: 'text-purple-500' };
    if (percentage >= 50) return { icon: Target, text: 'Halfway!', color: 'text-blue-500' };
    if (percentage >= 25) return { icon: Zap, text: 'Good start!', color: 'text-green-500' };
    return null;
  };

  const milestone = getMilestone();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {completed} / {total} comparisons
          </span>
          {milestone && (
            <Badge variant="outline" className="gap-1">
              <milestone.icon className={`h-3 w-3 ${milestone.color}`} />
              <span className={milestone.color}>{milestone.text}</span>
            </Badge>
          )}
        </div>
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
