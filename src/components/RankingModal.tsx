import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  const [rankings, setRankings] = useState<ImageWithWins[]>(winners.slice(0, 3));
  const [ratings, setRatings] = useState<Record<string, number>>({
    [winners[0]?.id]: 5,
    [winners[1]?.id]: 5,
    [winners[2]?.id]: 5,
  });
  const [submitting, setSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const calculateConfidence = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data: votes } = await supabase
        .from('votes')
        .select('is_tie')
        .eq('prompt_id', promptId)
        .eq('user_id', user.id);

      if (!votes || votes.length === 0) return 0;

      const tieCount = votes.filter(v => v.is_tie).length;
      const totalVotes = votes.length;
      return ((totalVotes - tieCount) / totalVotes) * 100;
    } catch (error) {
      console.error("Error calculating confidence:", error);
      return 0;
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

      const confidenceScore = await calculateConfidence();
      const completionTime = Math.floor((Date.now() - startTime) / 1000);

      // Save ranking
      await supabase.from("rankings").insert({
        prompt_id: promptId,
        user_email: userEmail,
        user_id: user.id,
        first_id: rankings[0].id,
        second_id: rankings[1].id,
        third_id: rankings[2].id,
        rating_first: ratings[rankings[0].id],
        rating_second: ratings[rankings[1].id],
        rating_third: ratings[rankings[2].id],
        confidence_score: confidenceScore,
        completion_time_seconds: completionTime,
      });

      // Mark prompt as completed
      await supabase.from("prompt_completions").upsert({
        user_id: user.id,
        prompt_id: promptId,
      });

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
          <DialogTitle className="text-2xl">Rank Top 3 & Rate Realism</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            These were the top 3 based on your votes. Drag to reorder if you'd like to adjust your ranking.
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
