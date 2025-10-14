import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trophy, Sparkles, ArrowDownUp, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

interface Image {
  id: string;
  model_name: string;
  image_url: string;
}

interface ImageWithWins extends Image {
  wins: number;
  elo?: number;
  inCycle?: boolean;
  h2hRelationships?: Record<string, { wins: number; losses: number }>;
}

interface RankingModalProps {
  open: boolean;
  winners: ImageWithWins[];
  promptId: string;
  userEmail: string;
  startTime: number;
  onComplete: () => void;
  onOpenChange?: (open: boolean) => void;
}

interface SortableImageProps {
  image: ImageWithWins;
  rank: number;
  rating: number;
  onRatingChange: (value: number) => void;
  rankingReason?: string;
  availableImages: ImageWithWins[];
  onReplace: (imageToSwap: ImageWithWins) => void;
  isSwapped?: boolean;
}

const SortableImageCompact = ({ image, rank, rating, onRatingChange, rankingReason, availableImages, onReplace, isSwapped }: SortableImageProps) => {
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
  };

  const rankColors = [
    "from-yellow-400/20 to-yellow-600/20 border-yellow-500",
    "from-gray-300/20 to-gray-400/20 border-gray-400",
    "from-orange-400/20 to-orange-600/20 border-orange-500",
  ];

  const rankEmojis = ["🥇", "🥈", "🥉"];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative rounded-lg border-2 bg-gradient-to-br ${rankColors[rank]} p-3 ${
        isDragging ? "opacity-50 cursor-grabbing" : "cursor-grab"
      } ${isSwapped ? "ring-2 ring-primary ring-offset-2" : ""}`}
    >
      {/* Drag handle - centered at top */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full p-1.5 bg-background border border-border shadow-sm z-10">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Rank badge */}
      <div className="text-center mb-2">
        <span className="text-3xl">{rankEmojis[rank]}</span>
        <p className="text-xs font-medium text-muted-foreground mt-1">
          {image.model_name}
        </p>
      </div>

      {/* Image */}
      <div className="aspect-square rounded-md overflow-hidden mb-3 border border-border">
        <img
          src={image.image_url}
          alt={image.model_name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs mb-3 px-1">
        <div className="flex items-center gap-1">
          <Trophy className="w-3 h-3 text-primary" />
          <span className="font-medium">{image.wins} wins</span>
        </div>
        {rankingReason && (
          <span className="text-muted-foreground truncate max-w-[120px]" title={rankingReason}>
            {rankingReason}
          </span>
        )}
      </div>

      {/* Replace button */}
      <div className="mb-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="w-full text-xs h-7"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Replace
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="center">
            <div className="space-y-2">
              <p className="text-sm font-medium">Replace with:</p>
              <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                {availableImages.length > 0 ? (
                  availableImages.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => onReplace(img)}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg border hover:border-primary hover:bg-accent transition-colors"
                    >
                      <div className="w-20 h-20 rounded overflow-hidden">
                        <img
                          src={img.image_url}
                          alt={img.model_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs font-medium truncate w-full text-center">
                        {img.model_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {img.wins} wins
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="col-span-2 text-xs text-muted-foreground p-2 text-center">
                    No other images available
                  </div>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Compact rating slider */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-xs font-medium">Realism</label>
          <span className="text-xs font-bold text-primary">{rating.toFixed(1)}/10</span>
        </div>
        <Slider
          value={[rating]}
          onValueChange={(value) => onRatingChange(value[0])}
          min={1}
          max={10}
          step={0.1}
          className="w-full"
        />
      </div>
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
  onOpenChange,
}: RankingModalProps) => {
  console.log('🎯 RankingModal received winners:', winners);
  console.log('🎯 RankingModal winners length:', winners?.length);

  // Preserve initial winners internally to protect against external state changes
  const [initialWinners, setInitialWinners] = useState<ImageWithWins[]>(
    winners && winners.length >= 3 ? winners : []
  );
  const [rankings, setRankings] = useState<ImageWithWins[]>(
    winners && winners.length >= 3 ? winners.slice(0, 3) : []
  );
  const [rankingReasons, setRankingReasons] = useState<Record<string, string>>({});
  const [showAllImages, setShowAllImages] = useState(false);
  const [showH2HStats, setShowH2HStats] = useState(false);
  const [swappedImageIds, setSwappedImageIds] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>(() => {
    if (!winners || winners.length < 3) return {};
    return {
      [winners[0].id]: 5,
      [winners[1].id]: 5,
      [winners[2].id]: 5,
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [qualityMetrics, setQualityMetrics] = useState<{
    consistencyScore: number;
    transitivityViolations: number;
    voteCertainty: number;
    qualityFlags: string[];
  } | null>(null);

  // Compute available images (exclude current top 3) - PHASE 1
  const computedAvailableImages = useMemo(() => {
    const rankingIds = new Set(rankings.map(r => r.id));
    return initialWinners.filter(img => !rankingIds.has(img.id));
  }, [rankings, initialWinners]);

  // Fallback recovery: if modal is open but rankings are empty, recover from initialWinners
  useEffect(() => {
    if (open && rankings.length === 0 && initialWinners.length >= 3) {
      console.log('🔄 Recovering rankings from initialWinners');
      setRankings(initialWinners.slice(0, 3));
      
      console.log('🎯 [Recovery] Available images for swapping:', initialWinners.length);
      
      // Generate H2H-based ranking reasons
      const reasons = generateRankingReasons(initialWinners);
      setRankingReasons(reasons);
    }
  }, [open, rankings.length, initialWinners]);

  // PHASE 5: Add loading state protection
  const [isLoadingWinners, setIsLoadingWinners] = useState(false);

  // Sync state when winners prop changes (but only if it's NEW data and not submitted)
  useEffect(() => {
    if (open && winners && winners.length >= 3 && !hasSubmitted) {
      // Check if this is actually NEW data (different from what we have)
      const isDifferentData = JSON.stringify(winners.map(w => w.id)) !== 
                             JSON.stringify(initialWinners.map(w => w.id));
      
      // Only sync if this is NEW data and we haven't submitted yet
      if ((isDifferentData && initialWinners.length === 0) || 
          (isDifferentData && !hasSubmitted)) {
        console.log('✅ Syncing rankings state with NEW winners:', winners);
        
        // PHASE 6: Comprehensive debug logging
        console.log('🎯 RankingModal State:', {
          open,
          winnersLength: winners?.length || 0,
          initialWinnersLength: initialWinners.length,
          rankingsLength: rankings.length,
          hasSubmitted,
        });
        
        setInitialWinners(winners);
        setRankings(winners.slice(0, 3));
        
        console.log('🎯 Available images for swapping:', winners.length, winners.map(a => a.model_name));
        console.log('🎯 Top 3 rankings:', winners.slice(0, 3).map((w, i) => `${i + 1}. ${w.model_name} (${w.wins}W, Elo: ${w.elo || 'N/A'}, inCycle: ${w.inCycle}, H2H: ${JSON.stringify(w.h2hRelationships || {})})`));
        
        // Generate H2H-based ranking reasons
        const reasons = generateRankingReasons(winners);
        setRankingReasons(reasons);
        
        setRatings({
          [winners[0].id]: 7,
          [winners[1].id]: 6,
          [winners[2].id]: 5,
        });
        // Load quality metrics
        loadQualityMetrics();
      }
    }
  }, [open, winners, hasSubmitted, initialWinners]);

  // Reset submission guard when modal closes
  useEffect(() => {
    if (!open) {
      // Reset submission guard after a delay when modal fully closes
      setTimeout(() => setHasSubmitted(false), 500);
    }
  }, [open]);

  // Generate ranking reasons based on H2H data - PHASE 2: Updated to support custom top 3
  const generateRankingReasons = (allWinners: ImageWithWins[], customTop3?: ImageWithWins[]): Record<string, string> => {
    const reasons: Record<string, string> = {};
    const top3 = customTop3 || allWinners.slice(0, 3);
    
    top3.forEach((winner, idx) => {
      if (idx === 0) {
        // Champion - check if beat both below
        if (winner.h2hRelationships) {
          const beatCount = Object.values(winner.h2hRelationships)
            .filter((r: any) => r.wins > r.losses).length;
          
          if (beatCount === 2) {
            reasons[winner.id] = `Champion (beat both below)`;
          } else if (beatCount === 1) {
            reasons[winner.id] = `Champion (beat one below)`;
          } else {
            reasons[winner.id] = `Champion (${winner.wins}W, Elo ${winner.elo})`;
          }
        } else {
          reasons[winner.id] = `Champion (${winner.wins}W)`;
        }
      } else {
        // 2nd and 3rd - show relationship to above
        const aboveWinner = top3[idx - 1];
        const h2h = winner.h2hRelationships?.[aboveWinner.id];
        
        if (h2h && h2h.wins > h2h.losses) {
          reasons[winner.id] = `${winner.wins}W (beat #${idx}, Elo ${winner.elo})`;
        } else if (h2h && h2h.wins < h2h.losses) {
          reasons[winner.id] = `${winner.wins}W (lost to #${idx})`;
        } else if (winner.elo) {
          reasons[winner.id] = `${winner.wins}W (Elo ${winner.elo})`;
        } else {
          reasons[winner.id] = `${winner.wins} wins`;
        }
      }
    });
    
    return reasons;
  };

  // PHASE 3: Recalculate H2H relationships for top 3 after a swap
  const recalculateH2HForTop3 = async (newTop3: ImageWithWins[]): Promise<ImageWithWins[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return newTop3;

      // Fetch all votes for this prompt
      const { data: votes } = await supabase
        .from('votes')
        .select('*')
        .eq('prompt_id', promptId)
        .eq('user_id', user.id);

      if (!votes) return newTop3;

      console.log('🔄 Recalculating H2H for new top 3:', newTop3.map(img => img.model_name));

      // Build H2H matrix for new top 3
      const h2hMatrix: Record<string, Record<string, { wins: number; losses: number }>> = {};
      
      newTop3.forEach(img1 => {
        h2hMatrix[img1.id] = {};
        newTop3.forEach(img2 => {
          if (img1.id !== img2.id) {
            const winsVsImg2 = votes.filter(v => 
              ((v.left_image_id === img1.id && v.right_image_id === img2.id) ||
               (v.left_image_id === img2.id && v.right_image_id === img1.id)) &&
              v.winner_id === img1.id
            ).length;
            
            const lossesVsImg2 = votes.filter(v => 
              ((v.left_image_id === img1.id && v.right_image_id === img2.id) ||
               (v.left_image_id === img2.id && v.right_image_id === img1.id)) &&
              v.winner_id === img2.id
            ).length;
            
            h2hMatrix[img1.id][img2.id] = { wins: winsVsImg2, losses: lossesVsImg2 };
          }
        });
      });

      // Update top 3 with new H2H data
      const updatedTop3 = newTop3.map(img => ({
        ...img,
        h2hRelationships: h2hMatrix[img.id]
      }));

      console.log('✅ Recalculated H2H:', updatedTop3.map(img => ({
        name: img.model_name,
        h2h: img.h2hRelationships
      })));

      return updatedTop3;
    } catch (error) {
      console.error('❌ Error recalculating H2H:', error);
      return newTop3;
    }
  };

  // PHASE 0: calculateMetrics moved before this function (see line 337)
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
      
      return metrics;
    } catch (error) {
      console.error('Error calculating metrics:', error);
      return null;
    }
  };

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

  // Show loading/error state if data is invalid (check initialWinners, not winners prop)
  if (!initialWinners || initialWinners.length < 3) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md glass">
          <DialogHeader>
            <DialogTitle>Calculating Rankings...</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              {!initialWinners || initialWinners.length === 0 
                ? 'Processing your votes...' 
                : `Only ${initialWinners.length} images ranked. Need at least 3.`}
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
        
        const reordered = arrayMove(items, oldIndex, newIndex);
        
        // Log user override
        console.log('🔄 User reordered:', {
          image: items[oldIndex].model_name,
          from: oldIndex + 1,
          to: newIndex + 1,
          reason: 'Manual drag-and-drop'
        });
        
        return reordered;
      });
    }
  };

  const handleSwapImage = async (imageToSwap: ImageWithWins, position: number) => {
    const oldImage = rankings[position];
    
    console.log('🔄 Swap Details:', {
      swapIn: {
        name: imageToSwap.model_name,
        wins: imageToSwap.wins,
        elo: imageToSwap.elo,
        h2hKeys: Object.keys(imageToSwap.h2hRelationships || {})
      },
      swapOut: {
        name: oldImage.model_name,
        wins: oldImage.wins,
        elo: oldImage.elo,
      },
      position: position + 1,
      availableCount: computedAvailableImages.length
    });

    const newRankings = [...rankings];
    newRankings[position] = imageToSwap;
    
    // PHASE 3: Recalculate H2H for new top 3
    const rankingsWithH2H = await recalculateH2HForTop3(newRankings);
    setRankings(rankingsWithH2H);
    
    // PHASE 4: Deduplicate swapped image IDs
    setSwappedImageIds(prev => {
      const uniqueIds = new Set([...prev, imageToSwap.id]);
      return Array.from(uniqueIds);
    });
    
    // Set default rating for swapped image
    setRatings(prev => ({
      ...prev,
      [imageToSwap.id]: 5,
    }));

    // PHASE 2: Regenerate all ranking reasons with H2H context
    const updatedReasons = generateRankingReasons(initialWinners, rankingsWithH2H);
    setRankingReasons(updatedReasons);

    // PHASE 5: Show toast feedback
    toast.success(`Swapped ${oldImage.model_name} → ${imageToSwap.model_name}`, {
      description: `Position #${position + 1} updated`,
      duration: 2000,
    });
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

  const handleSubmit = async () => {
    if (hasSubmitted) {
      toast.info("Rankings already submitted!");
      return;
    }

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
        
        // Track if user changed the order (compare against initial winners, not current winners prop)
        user_modified_order: JSON.stringify(rankings.map(r => r.id)) !== JSON.stringify(initialWinners.slice(0, 3).map(w => w.id)),
        
        // Track swapped images
        swapped_images_count: swappedImageIds.length,
        swapped_image_ids: swappedImageIds,
      };

      console.log('💾 Saving ranking with metrics:', rankingData);

      // Save ranking (upsert to handle duplicate submissions)
      const { error: rankingError } = await supabase
        .from("rankings")
        .upsert(rankingData, {
          onConflict: 'prompt_id,user_email'
        });

      if (rankingError) {
        console.error('Ranking upsert error:', rankingError);
        throw rankingError;
      }

      // Mark prompt as completed (upsert to handle duplicates)
      const { error: completionError } = await supabase
        .from("prompt_completions")
        .upsert({
          user_id: user.id,
          prompt_id: promptId,
        }, {
          onConflict: 'user_id,prompt_id'
        });

      if (completionError) {
        console.error('Completion upsert error:', completionError);
        // Don't throw - this is non-critical
      }

      // Update comparison session with final quality metrics
      const { error: sessionUpdateError } = await supabase
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
      
      if (sessionUpdateError) {
        console.error('⚠️ Error updating session metrics:', sessionUpdateError);
        // Non-critical - don't throw, just log
      }

      toast.success("Rankings saved successfully!");
      setHasSubmitted(true);
      
      // PHASE 5: Add delay before closing modal
      setTimeout(() => {
        onComplete();
      }, 500);
    } catch (error: any) {
      console.error("Error saving rankings:", error);
      
      // Handle specific error codes
      if (error?.code === '403' || error?.code === 'PGRST301') {
        toast.error("Permission denied. Please try refreshing the page.");
      } else if (error?.code === '409' || error?.code === '23505' || error?.message?.includes('duplicate')) {
        toast.success("Rankings already saved!");
        setHasSubmitted(true);
        onComplete();
      } else if (error?.message?.includes('upsert')) {
        toast.error("Unable to save rankings. This prompt may have already been completed.");
      } else {
        toast.error("Failed to save rankings");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            🎉 Your Top 3 Rankings
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Drag to reorder, adjust realism ratings, or swap images from below. Your final ranking will be saved.
          </DialogDescription>
        </DialogHeader>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={rankings.map((r) => r.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {rankings.map((image, index) => (
                <SortableImageCompact
                  key={image.id}
                  image={image}
                  rank={index}
                  rating={ratings[image.id]}
                  onRatingChange={(value) =>
                    setRatings({ ...ratings, [image.id]: value })
                  }
                  rankingReason={rankingReasons[image.id]}
                  availableImages={computedAvailableImages}
                  onReplace={(imageToSwap) => handleSwapImage(imageToSwap, index)}
                  isSwapped={swappedImageIds.includes(image.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* View Other Images Section */}
        {computedAvailableImages.length > 0 && (
          <div className="border-t pt-4 mt-6">
            <button
              onClick={() => setShowAllImages(!showAllImages)}
              className="flex items-center justify-between w-full text-sm font-medium hover:text-primary transition-colors mb-3"
            >
              <span className="flex items-center gap-2">
                <ArrowDownUp className="w-4 h-4" />
                View Other Images ({computedAvailableImages.length})
              </span>
              {showAllImages ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {showAllImages && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {computedAvailableImages.map((img) => (
                  <div key={img.id} className="group relative rounded-lg border overflow-hidden hover:border-primary transition-colors">
                    <div className="aspect-square">
                      <img
                        src={img.image_url}
                        alt={img.model_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                      <p className="text-white text-xs font-medium text-center">{img.model_name}</p>
                      <p className="text-white/80 text-xs">{img.wins} wins</p>
                      <div className="flex gap-1">
                        {[0, 1, 2].map((pos) => (
                          <button
                            key={pos}
                            onClick={() => handleSwapImage(img, pos)}
                            className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded hover:bg-primary/90 transition-colors"
                          >
                            → {pos === 0 ? '🥇' : pos === 1 ? '🥈' : '🥉'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Head-to-Head Stats Section */}
        {rankings.length === 3 && rankings[0].h2hRelationships && (
          <div className="border-t pt-4 mt-6">
            <button
              onClick={() => setShowH2HStats(!showH2HStats)}
              className="flex items-center justify-between w-full text-sm font-medium hover:text-primary transition-colors"
            >
              <span>View Head-to-Head Records</span>
              {showH2HStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {showH2HStats && (
              <div className="mt-3 space-y-3 text-sm">
                {rankings.map((img, idx) => (
                  <div key={img.id} className="border-l-2 border-primary/50 pl-3">
                    <p className="font-medium">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} {img.model_name}
                    </p>
                    {img.h2hRelationships && Object.entries(img.h2hRelationships).map(([otherId, record]: any) => {
                      const other = rankings.find(r => r.id === otherId);
                      if (!other) return null;
                      
                      const totalMatches = record.wins + record.losses;
                      const displayText = totalMatches === 0 
                        ? `vs ${other.model_name}: No direct matchups`
                        : `vs ${other.model_name}: ${record.wins}-${record.losses}`;
                      
                      return (
                        <p key={otherId} className="text-xs text-muted-foreground ml-4">
                          {displayText}
                          {record.wins > record.losses && totalMatches > 0 && ' ✅'}
                          {record.wins < record.losses && totalMatches > 0 && ' ❌'}
                        </p>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full mt-6"
          size="lg"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Saving rankings...
            </span>
          ) : (
            "Submit Rankings"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
