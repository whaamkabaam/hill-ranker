import { useEffect, useState } from "react";
import { ImageCard } from "./ImageCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, RotateCcw } from "lucide-react";

interface Image {
  id: string;
  model_name: string;
  image_url: string;
}

interface ImageWithWins extends Image {
  wins: number;
}

interface ComparisonViewProps {
  promptId: string;
  promptText: string;
  images: Image[];
  userEmail: string;
  onComplete: (winners: ImageWithWins[]) => void;
  onSkip?: () => void;
}

export const ComparisonView = ({
  promptId,
  promptText,
  images,
  userEmail,
  onComplete,
  onSkip,
}: ComparisonViewProps) => {
  const [king, setKing] = useState<Image | null>(null);
  const [challenger, setChallenger] = useState<Image | null>(null);
  const [remainingImages, setRemainingImages] = useState<Image[]>([]);
  const [completedComparisons, setCompletedComparisons] = useState(0);
  const [voteHistory, setVoteHistory] = useState<string[]>([]);
  const [startTime] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);

  const totalComparisons = images.length > 0 ? images.length - 1 : 0;

  // Check for existing votes on load
  useEffect(() => {
    const checkExistingVotes = async () => {
      if (images.length === 0) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: existingVotes } = await supabase
          .from('votes')
          .select('*')
          .eq('prompt_id', promptId)
          .eq('user_id', user.id);

        if (existingVotes && existingVotes.length > 0) {
          if (existingVotes.length >= totalComparisons) {
            // Already completed - calculate rankings and skip to modal
            const rankedImages = await calculateRankingsFromVotes(existingVotes);
            onComplete(rankedImages);
            return;
          } else {
            toast.info(`Resuming: ${existingVotes.length} of ${totalComparisons} comparisons completed`);
            setCompletedComparisons(existingVotes.length);
            setVoteHistory(existingVotes.map(v => v.id));
          }
        }

        // Initialize comparison
        setKing(images[0]);
        setRemainingImages(images.slice(1));
        setIsLoading(false);
      } catch (error) {
        console.error("Error checking existing votes:", error);
        setIsLoading(false);
      }
    };

    checkExistingVotes();
  }, [images, promptId]);

  useEffect(() => {
    if (remainingImages.length > 0 && king) {
      setChallenger(remainingImages[0]);
    } else if (king && remainingImages.length === 0 && challenger === null && !isLoading) {
      // Tournament complete
      handleTournamentComplete();
    }
  }, [remainingImages, king, challenger, isLoading]);

  useEffect(() => {
    const handleKeyPress = async (e: KeyboardEvent) => {
      if (!king || !challenger) return;

      if (e.key.toLowerCase() === "a") {
        await handleSelection(king);
      } else if (e.key.toLowerCase() === "l") {
        await handleSelection(challenger);
      } else if (e.key.toLowerCase() === "t") {
        await handleTie();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [king, challenger]);

  const calculateRankingsFromVotes = async (votes: any[]): Promise<ImageWithWins[]> => {
    const winCounts: Record<string, number> = {};

    votes.forEach(vote => {
      if (vote.is_tie) {
        // Both get half a point for ties
        winCounts[vote.left_image_id] = (winCounts[vote.left_image_id] || 0) + 0.5;
        winCounts[vote.right_image_id] = (winCounts[vote.right_image_id] || 0) + 0.5;
      } else if (vote.winner_id) {
        winCounts[vote.winner_id] = (winCounts[vote.winner_id] || 0) + 1;
      }
    });

    // Sort images by win count (descending) and take top 3
    const rankedImages = images
      .map(img => ({ ...img, wins: winCounts[img.id] || 0 }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 3);

    return rankedImages;
  };

  const handleTournamentComplete = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: allVotes } = await supabase
        .from('votes')
        .select('*')
        .eq('prompt_id', promptId)
        .eq('user_id', user.id);

      if (allVotes) {
        const rankedImages = await calculateRankingsFromVotes(allVotes);
        onComplete(rankedImages);
      }
    } catch (error) {
      console.error("Error completing tournament:", error);
      toast.error("Failed to calculate rankings");
    }
  };

  const handleSelection = async (winner: Image) => {
    if (!king || !challenger) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to vote");
        return;
      }

      const { data, error } = await supabase.from("votes").insert({
        prompt_id: promptId,
        user_email: userEmail,
        user_id: user.id,
        left_image_id: king.id,
        right_image_id: challenger.id,
        winner_id: winner.id,
        is_tie: false,
      }).select().single();

      if (error) throw error;

      setVoteHistory(prev => [...prev, data.id]);
      setCompletedComparisons(prev => prev + 1);

      if (winner.id === king.id) {
        // King stays, move to next challenger
        setRemainingImages(remainingImages.slice(1));
        setChallenger(null);
      } else {
        // Challenger becomes new king
        setKing(challenger);
        setRemainingImages(remainingImages.slice(1));
        setChallenger(null);
      }
    } catch (error) {
      console.error("Error saving vote:", error);
      toast.error("Failed to save vote");
    }
  };

  const handleTie = async () => {
    if (!king || !challenger) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to vote");
        return;
      }

      const { data, error } = await supabase.from("votes").insert({
        prompt_id: promptId,
        user_email: userEmail,
        user_id: user.id,
        left_image_id: king.id,
        right_image_id: challenger.id,
        winner_id: null,
        is_tie: true,
      }).select().single();

      if (error) throw error;

      setVoteHistory(prev => [...prev, data.id]);
      setCompletedComparisons(prev => prev + 1);

      // King stays on tie
      setRemainingImages(remainingImages.slice(1));
      setChallenger(null);
    } catch (error) {
      console.error("Error saving tie:", error);
      toast.error("Failed to save tie");
    }
  };

  const handleUndo = async () => {
    if (voteHistory.length === 0) {
      toast.error("No votes to undo");
      return;
    }

    try {
      const lastVoteId = voteHistory[voteHistory.length - 1];
      
      const { error } = await supabase
        .from('votes')
        .delete()
        .eq('id', lastVoteId);

      if (error) throw error;

      toast.success("Last vote undone");
      
      // Reload the page to reset state properly
      window.location.reload();
    } catch (error) {
      console.error("Error undoing vote:", error);
      toast.error("Failed to undo vote");
    }
  };

  if (isLoading || !king || !challenger) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading comparison...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header with Progress */}
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Current Prompt</p>
            <h2 className="text-xl font-medium">{promptText}</h2>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Comparisons</span>
              <span className="font-medium">{completedComparisons} / {totalComparisons}</span>
            </div>
            <Progress value={(completedComparisons / totalComparisons) * 100} />
          </div>
        </div>

        {/* Comparison */}
        <div className="flex gap-8 items-start">
          <ImageCard
            imageUrl={king.image_url}
            modelName={king.model_name}
            side="left"
            isKing={true}
          />
          <ImageCard
            imageUrl={challenger.image_url}
            modelName={challenger.model_name}
            side="right"
          />
        </div>

        {/* Controls */}
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="flex justify-center items-center gap-4">
            <Button
              onClick={() => handleSelection(king)}
              variant="outline"
              size="lg"
              className="glass-hover"
            >
              A - Left Wins
            </Button>
            <Button
              onClick={handleTie}
              variant="outline"
              size="lg"
              className="glass-hover"
            >
              T - Tie
            </Button>
            <Button
              onClick={() => handleSelection(challenger)}
              variant="outline"
              size="lg"
              className="glass-hover"
            >
              L - Right Wins
            </Button>
          </div>
          
          <div className="flex justify-between items-center">
            <Button
              onClick={handleUndo}
              variant="ghost"
              size="sm"
              disabled={voteHistory.length === 0}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Undo Last Vote
            </Button>
            
            {onSkip && (
              <Button
                onClick={() => {
                  if (confirm('Skip this prompt? Your progress won\'t be saved.')) {
                    onSkip();
                  }
                }}
                variant="ghost"
                size="sm"
              >
                Skip Prompt
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
