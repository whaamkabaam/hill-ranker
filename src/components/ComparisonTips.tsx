import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Lightbulb, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const tips = [
  'Look closely at details like hands, faces, and small objects - these often reveal AI artifacts.',
  'Consider overall composition and lighting. Does it feel natural and well-balanced?',
  'Vote based on realism and quality, not personal preference or style.',
  'Pay attention to text rendering - AI models often struggle with accurate text.',
  'Check for anatomical accuracy and realistic proportions in people and objects.',
  'Evaluate shadows and reflections - do they make physical sense?',
  'Take your time! A thoughtful evaluation leads to better results.',
  'If two images are truly equal in quality, use the tie option.',
  'Background details matter too - check for coherence and logical elements.',
  'Your votes help improve AI models - be thoughtful!',
];

export default function ComparisonTips() {
  const [currentTip, setCurrentTip] = useState('');
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Show random tip
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    setCurrentTip(randomTip);

    // Rotate tips every 30 seconds
    const interval = setInterval(() => {
      const newTip = tips[Math.floor(Math.random() * tips.length)];
      setCurrentTip(newTip);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsVisible(true)}
        className="gap-2"
      >
        <Lightbulb className="h-4 w-4" />
        Show Tips
      </Button>
    );
  }

  return (
    <Card className="p-4 bg-primary/5 border-primary/20 animate-fade-in">
      <div className="flex items-start gap-3">
        <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-sm flex-1">{currentTip}</p>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 -mt-1 -mr-1"
          onClick={() => setIsVisible(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
