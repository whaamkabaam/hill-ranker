import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calculateQualityMetrics } from "@/lib/rankingMetrics";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trophy } from "lucide-react";

interface Image {
  id: string;
  model_name: string;
  image_url: string;
}

interface ImageWithWins extends Image {
  wins: number;
}

interface RankingModalProps {
  open: boolean;
  winners: ImageWithWins[];
  promptId: string;
  userEmail: string;
  startTime: number;
  onComplete: () => void;
}

interface SortableImageProps {
  image: ImageWithWins;
  rank: number;
  rating: number;
  onRatingChange: (value: number) => void;
}

const SortableImage = ({ image, rank, rating, onRatingChange }: SortableImageProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const rankColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];
  const rankIcons = ['🥇', '🥈', '🥉'];

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: rank * 0.1 }}
        className="space-y-4 glass rounded-xl p-4"
      >
        <div className="flex items-start gap-4">
          <button
            className="mt-2 cursor-grab active:cursor-grabbing touch-none p-2 hover:bg-accent rounded-lg transition-colors"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-5 h-5 text-muted-foreground" />
          </button>

          <div className="flex-1 space-y-4">
            <div className="relative">
              <div className="glass rounded-xl overflow-hidden">
                <img
                  src={image.image_url}
                  alt={image.model_name}
                  className="w-full aspect-square object-cover"
                />
              </div>
              <div className={`absolute top-2 left-2 bg-background/90 backdrop-blur-sm text-foreground rounded-full w-12 h-12 flex items-center justify-center font-bold text-2xl border-2 ${rank === 0 ? 'border-yellow-500' : rank === 1 ? 'border-gray-400' : 'border-amber-600'}`}>
                {rankIcons[rank]}
              </div>
              <div className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm rounded-full px-3 py-1">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{image.wins} wins</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-center">{image.model_name}</p>
              
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground block text-center">
                  Realism Rating: {rating.toFixed(1)}
                </label>
                <Slider
                  min={1}
                  max={10}
                  step={0.1}
                  value={[rating]}
                  onValueChange={([value]) => onRatingChange(value)}
                  className="py-4"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1.0 - Not Realistic</span>
                  <span>10.0 - Very Realistic</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const RankingModal = ({
  open,
  winners,
  promptId,
  userEmail,
  startTime,
  onComplete,
}: RankingModalProps) => {
  console.log('🎯 RankingModal received winners:', winners);
  console.log('🎯 RankingModal winners length:', winners?.length);

  const [rankings, setRankings] = useState<ImageWithWins[]>(
    winners && winners.length >= 3 ? winners.slice(0, 3) : []
  );
  const [ratings, setRatings] = useState<Record<string, number>>(() => {
    if (!winners || winners.length < 3) return {};
    return {
      [winners[0].id]: 5,
      [winners[1].id]: 5,
      [winners[2].id]: 5,
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [qualityMetrics, setQualityMetrics] = useState<{
    consistencyScore: number;
    transitivityViolations: number;
    voteCertainty: number;
    qualityFlags: string[];
  } | null>(null);

  // Sync state when winners prop changes
  useEffect(() => {
    if (winners && winners.length >= 3) {
      console.log('✅ Syncing rankings state with winners:', winners);
      setRankings(winners.slice(0, 3));
      setRatings({
        [winners[0].id]: 5,
        [winners[1].id]: 5,
        [winners[2].id]: 5,
      });
      // Load quality metrics
      loadQualityMetrics();
    }
  }, [winners]);

  const loadQualityMetrics = async () => {
    const metrics = await calculateMetrics();
    if (metrics) {
      setQualityMetrics({
        consistencyScore: metrics.consistencyScore,
        transitivityViolations: metrics.transitivityViolations,
        voteCertainty: metrics.voteCertainty,
        qualityFlags: metrics.qualityFlags,
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Show loading/error state if data is invalid
  if (!winners || winners.length < 3) {
    return (
      <Dialog open={open}>
        <DialogContent className="max-w-md glass">
          <DialogHeader>
            <DialogTitle>Calculating Rankings...</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              {!winners || winners.length === 0 
                ? 'Processing your votes...' 
                : `Only ${winners.length} images ranked. Need at least 3.`}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setRankings((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const validateRankings = () => {
    // Ensure all 3 are different
    const uniqueIds = new Set(rankings.map(r => r.id));
    if (uniqueIds.size !== 3) {
      toast.error('Rankings must be different images');
      return false;
    }

    // Ensure ratings are reasonable
    for (const rating of Object.values(ratings)) {
      if (rating < 1 || rating > 10) {
        toast.error('Ratings must be between 1 and 10');
        return false;
      }
    }

    return true;
  };

  const calculateMetrics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: votes } = await supabase
        .from('votes')
        .select('*')
        .eq('prompt_id', promptId)
        .eq('user_id', user.id);

      if (!votes || votes.length === 0) return null;

      // Calculate all quality metrics
      const metrics = calculateQualityMetrics(votes);
      
      console.log('📊 Quality Metrics:', metrics);
      
      // Show warnings for quality issues
      if (metrics.qualityFlags.length > 0) {
        if (metrics.qualityFlags.includes('too_fast')) {
          toast.info('You voted quite quickly. Please ensure your ranking is accurate.');
        }
      }
      
      return metrics;
    } catch (error) {
      console.error("Error calculating metrics:", error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!validateRankings()) {
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      // Calculate all metrics
      const metrics = await calculateMetrics();
      const completionTime = Math.floor((Date.now() - startTime) / 1000);

      // Prepare ranking data with quality metrics
      const rankingData = {
        prompt_id: promptId,
        user_email: userEmail,
        user_id: user.id,
        first_id: rankings[0].id,
        second_id: rankings[1].id,
        third_id: rankings[2].id,
        rating_first: ratings[rankings[0].id],
        rating_second: ratings[rankings[1].id],
        rating_third: ratings[rankings[2].id],
        completion_time_seconds: completionTime,
        // Quality metrics
        consistency_score: metrics?.consistencyScore || null,
        transitivity_violations: metrics?.transitivityViolations || 0,
        vote_certainty: metrics?.voteCertainty || null,
        average_vote_time_seconds: metrics?.averageVoteTime || null,
        quality_flags: metrics?.qualityFlags || [],
        // Legacy confidence score (kept for backwards compatibility)
        confidence_score: metrics?.voteCertainty || 0,
      };

      console.log('💾 Saving ranking with metrics:', rankingData);

      // Save ranking
      await supabase.from("rankings").insert(rankingData);

      // Mark prompt as completed
      await supabase.from("prompt_completions").upsert({
        user_id: user.id,
        prompt_id: promptId,
      });

      // Update comparison session with final quality metrics
      await supabase
        .from("comparison_sessions")
        .update({
          consistency_score: metrics?.consistencyScore || null,
          vote_certainty: metrics?.voteCertainty || null,
          transitivity_violations: metrics?.transitivityViolations || 0,
          average_vote_time_seconds: metrics?.averageVoteTime || null,
          quality_flags: metrics?.qualityFlags || [],
        })
        .eq('user_id', user.id)
        .eq('prompt_id', promptId);

      toast.success("Rankings saved successfully!");
      onComplete();
    } catch (error) {
      console.error("Error saving rankings:", error);
      toast.error("Failed to save rankings");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto glass">
        <DialogHeader>
          <DialogTitle className="text-2xl">🎉 Ranking Complete - Models Revealed!</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            These were the top 3 based on your blind votes. Now you can see which models you preferred. Drag to reorder if you'd like to adjust.
          </p>
        </DialogHeader>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={rankings.map(r => r.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-6 mt-6">
              {rankings.map((image, index) => (
                <SortableImage
                  key={image.id}
                  image={image}
                  rank={index}
                  rating={ratings[image.id]}
                  onRatingChange={(value) =>
                    setRatings({ ...ratings, [image.id]: value })
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Quality Metrics Display */}
        {qualityMetrics && (
          <div className="mt-6 p-4 glass rounded-xl space-y-3">
            <h3 className="font-medium text-sm">Voting Quality Metrics</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Vote Certainty</p>
                <p className={`font-medium ${
                  qualityMetrics.voteCertainty >= 70 ? 'text-green-500' :
                  qualityMetrics.voteCertainty >= 50 ? 'text-yellow-500' :
                  'text-red-500'
                }`}>
                  {qualityMetrics.voteCertainty.toFixed(1)}%
                </p>
              </div>
            </div>
            {qualityMetrics.transitivityViolations > 0 && (
              <p className="text-xs text-yellow-500">
                ⚠️ {qualityMetrics.transitivityViolations} transitivity violation(s) detected
              </p>
            )}
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full mt-6"
          size="lg"
        >
          {submitting ? "Saving..." : "Submit Rankings"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
