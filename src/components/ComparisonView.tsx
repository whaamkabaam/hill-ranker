import { useEffect, useState } from "react";
import { ImageCard } from "./ImageCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, RotateCcw, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import ImageCardSkeleton from "./ImageCardSkeleton";
import ComparisonTips from "./ComparisonTips";
import ProgressGamification from "./ProgressGamification";

interface Image {
  id: string;
  model_name: string;
  image_url: string;
}

interface ImageWithWins extends Image {
  wins: number;
  elo?: number;
}

interface ImagePair {
  left: Image;
  right: Image;
  pairId: string;
}

interface ComparisonViewProps {
  promptId: string;
  promptText: string;
  images: Image[];
  userEmail: string;
  onComplete: (winners: ImageWithWins[]) => void;
  onSkip?: () => void;
}

// Utility: Generate all possible pairs for Round-Robin
const generateAllPairs = (images: Image[]): ImagePair[] => {
  const pairs: ImagePair[] = [];
  for (let i = 0; i < images.length; i++) {
    for (let j = i + 1; j < images.length; j++) {
      pairs.push({
        left: images[i],
        right: images[j],
        pairId: `${images[i].id}-${images[j].id}`,
      });
    }
  }
  return pairs;
};

// Utility: Calculate Elo ratings from votes
const calculateEloRatings = (images: Image[], votes: any[]): ImageWithWins[] => {
  const K = 32; // Elo K-factor
  const ratings: Record<string, number> = {};
  const wins: Record<string, number> = {};

  // Initialize ratings and wins
  images.forEach(img => {
    ratings[img.id] = 1500; // Starting Elo
    wins[img.id] = 0;
  });

  // Process each vote to update Elo
  votes.forEach(vote => {
    const leftId = vote.left_image_id;
    const rightId = vote.right_image_id;
    
    if (!ratings[leftId] || !ratings[rightId]) return;

    const expectedLeft = 1 / (1 + Math.pow(10, (ratings[rightId] - ratings[leftId]) / 400));
    const expectedRight = 1 - expectedLeft;

    let actualLeft = 0.5;
    let actualRight = 0.5;

    if (vote.is_tie) {
      wins[leftId] += 0.5;
      wins[rightId] += 0.5;
    } else if (vote.winner_id === leftId) {
      actualLeft = 1;
      actualRight = 0;
      wins[leftId] += 1;
    } else if (vote.winner_id === rightId) {
      actualLeft = 0;
      actualRight = 1;
      wins[rightId] += 1;
    }

    ratings[leftId] += K * (actualLeft - expectedLeft);
    ratings[rightId] += K * (actualRight - expectedRight);
  });

  return images
    .map(img => ({
      ...img,
      wins: wins[img.id] || 0,
      elo: Math.round(ratings[img.id]),
    }))
    .sort((a, b) => (b.elo || 0) - (a.elo || 0));
};

export const ComparisonView = ({
  promptId,
  promptText,
  images,
  userEmail,
  onComplete,
  onSkip,
}: ComparisonViewProps) => {
  const [allPairs, setAllPairs] = useState<ImagePair[]>([]);
  const [currentPairIndex, setCurrentPairIndex] = useState(0);
  const [completedPairs, setCompletedPairs] = useState<Set<string>>(new Set());
  const [voteHistory, setVoteHistory] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });

  const totalComparisons = allPairs.length;
  const currentPair = allPairs[currentPairIndex] || null;

  // Initialize pairs and check for existing votes
  useEffect(() => {
    const initializePairs = async () => {
      if (images.length < 2) {
        toast.error("Need at least 2 images to compare");
        setIsLoading(false);
        return;
      }

      // Generate all possible pairs
      const pairs = generateAllPairs(images);
      setAllPairs(pairs);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        // Create or get existing session
        const { data: existingSession } = await supabase
          .from('comparison_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('prompt_id', promptId)
          .single();

        if (existingSession) {
          setSessionId(existingSession.id);
        } else {
          // Create new session
          const { data: newSession } = await supabase
            .from('comparison_sessions')
            .insert({
              user_id: user.id,
              prompt_id: promptId,
              total_comparisons: pairs.length,
              completed_comparisons: 0,
            })
            .select()
            .single();
          
          if (newSession) {
            setSessionId(newSession.id);
          }
        }

        // Fetch existing votes
        const { data: existingVotes } = await supabase
          .from('votes')
          .select('*')
          .eq('prompt_id', promptId)
          .eq('user_id', user.id);

        if (existingVotes && existingVotes.length > 0) {
          // Build completed pairs set
          const completed = new Set<string>();
          existingVotes.forEach(vote => {
            const pairId1 = `${vote.left_image_id}-${vote.right_image_id}`;
            const pairId2 = `${vote.right_image_id}-${vote.left_image_id}`;
            completed.add(pairId1);
            completed.add(pairId2);
          });
          
          setCompletedPairs(completed);
          setVoteHistory(existingVotes.map(v => v.id));

          // Check if all pairs are completed
          if (existingVotes.length >= pairs.length) {
            console.log('✅ All pairs completed, calculating rankings...');
            const rankedImages = calculateEloRatings(images, existingVotes);
            const top3 = rankedImages.slice(0, 3);
            
            if (top3.length >= 3) {
              onComplete(top3);
              return;
            }
          }

          // Find next uncompleted pair
          const nextPairIndex = pairs.findIndex(p => !completed.has(p.pairId));
          if (nextPairIndex !== -1) {
            setCurrentPairIndex(nextPairIndex);
            toast.info(`Resuming: ${existingVotes.length} of ${pairs.length} comparisons completed`);
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Error initializing pairs:", error);
        toast.error("Failed to load comparison state");
        setIsLoading(false);
      }
    };

    initializePairs();
  }, [images, promptId]);

  // Check for completion after each vote
  useEffect(() => {
    if (isLoading || allPairs.length === 0) return;

    if (completedPairs.size >= allPairs.length) {
      handleComparisonComplete();
    }
  }, [completedPairs, allPairs, isLoading]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = async (e: KeyboardEvent) => {
      if (!currentPair) return;

      if (e.key.toLowerCase() === "a") {
        await handleSelection(currentPair.left);
      } else if (e.key.toLowerCase() === "l") {
        await handleSelection(currentPair.right);
      } else if (e.key.toLowerCase() === "t") {
        await handleTie();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentPair]);

  const handleComparisonComplete = async () => {
    try {
      console.log('🏁 All comparisons complete, calculating Elo rankings...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ No user found');
        return;
      }

      const { data: allVotes } = await supabase
        .from('votes')
        .select('*')
        .eq('prompt_id', promptId)
        .eq('user_id', user.id);

      console.log('📊 All votes fetched:', allVotes?.length || 0);

      if (allVotes && allVotes.length >= allPairs.length) {
        // Validate all pairs completed
        const votedPairs = new Set<string>();
        allVotes.forEach(vote => {
          votedPairs.add(`${vote.left_image_id}-${vote.right_image_id}`);
        });

        const missingPairs = allPairs.filter(p => !votedPairs.has(p.pairId));
        if (missingPairs.length > 0) {
          console.warn('⚠️ Missing pairs:', missingPairs.length);
          toast.error(`Missing ${missingPairs.length} comparisons. Please complete all pairs.`);
          return;
        }

        const rankedImages = calculateEloRatings(images, allVotes);
        const top3 = rankedImages.slice(0, 3);
        
        console.log('🏆 Top 3 by Elo:', top3.map(img => ({ 
          model: img.model_name, 
          elo: img.elo, 
          wins: img.wins 
        })));

        if (top3.length >= 3) {
          // Update session as completed
          if (sessionId) {
            await supabase
              .from('comparison_sessions')
              .update({
                completed_at: new Date().toISOString(),
                completed_comparisons: allPairs.length,
              })
              .eq('id', sessionId);
          }

          console.log('✅ Calling onComplete with:', top3);
          onComplete(top3);
        } else {
          console.error('❌ Not enough ranked images');
          toast.error('Unable to generate rankings');
        }
      } else {
        console.error('❌ Insufficient votes');
        toast.error('Not all comparisons completed');
      }
    } catch (error) {
      console.error("❌ Error completing comparison:", error);
      toast.error("Failed to calculate rankings");
    }
  };

  const handleSelection = async (winner: Image) => {
    if (!currentPair) return;

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
        left_image_id: currentPair.left.id,
        right_image_id: currentPair.right.id,
        winner_id: winner.id,
        is_tie: false,
      }).select().single();

      if (error) throw error;

      setVoteHistory(prev => [...prev, data.id]);
      setCompletedPairs(prev => new Set([...prev, currentPair.pairId]));

      // Update session progress
      if (sessionId) {
        await supabase
          .from('comparison_sessions')
          .update({ 
            completed_comparisons: completedPairs.size + 1 
          })
          .eq('id', sessionId);
      }

      // Move to next uncompleted pair
      moveToNextPair();
    } catch (error) {
      console.error("Error saving vote:", error);
      toast.error("Failed to save vote");
    }
  };

  const handleTie = async () => {
    if (!currentPair) return;

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
        left_image_id: currentPair.left.id,
        right_image_id: currentPair.right.id,
        winner_id: null,
        is_tie: true,
      }).select().single();

      if (error) throw error;

      setVoteHistory(prev => [...prev, data.id]);
      setCompletedPairs(prev => new Set([...prev, currentPair.pairId]));

      // Update session progress
      if (sessionId) {
        await supabase
          .from('comparison_sessions')
          .update({ 
            completed_comparisons: completedPairs.size + 1 
          })
          .eq('id', sessionId);
      }

      // Move to next uncompleted pair
      moveToNextPair();
    } catch (error) {
      console.error("Error saving tie:", error);
      toast.error("Failed to save tie");
    }
  };

  const moveToNextPair = () => {
    const nextIndex = allPairs.findIndex((p, idx) => 
      idx > currentPairIndex && !completedPairs.has(p.pairId)
    );

    if (nextIndex !== -1) {
      setCurrentPairIndex(nextIndex);
    } else {
      // Check from beginning for any missed pairs
      const firstIncomplete = allPairs.findIndex(p => !completedPairs.has(p.pairId));
      if (firstIncomplete !== -1) {
        setCurrentPairIndex(firstIncomplete);
      }
    }
  };

  const handleUndo = async () => {
    if (voteHistory.length === 0) {
      toast.error("No votes to undo");
      return;
    }

    try {
      const lastVoteId = voteHistory[voteHistory.length - 1];
      
      // Get the vote details before deleting
      const { data: voteToUndo } = await supabase
        .from('votes')
        .select('*')
        .eq('id', lastVoteId)
        .single();

      if (!voteToUndo) {
        toast.error("Vote not found");
        return;
      }

      // Delete the vote
      const { error } = await supabase
        .from('votes')
        .delete()
        .eq('id', lastVoteId);

      if (error) throw error;

      // Update state without reload
      setVoteHistory(prev => prev.slice(0, -1));
      
      const undoneePairId = `${voteToUndo.left_image_id}-${voteToUndo.right_image_id}`;
      setCompletedPairs(prev => {
        const newSet = new Set(prev);
        newSet.delete(undoneePairId);
        return newSet;
      });

      // Move back to the undone pair
      const pairIndex = allPairs.findIndex(p => p.pairId === undoneePairId);
      if (pairIndex !== -1) {
        setCurrentPairIndex(pairIndex);
      }

      toast.success("Last vote undone");
    } catch (error) {
      console.error("Error undoing vote:", error);
      toast.error("Failed to undo vote");
    }
  };

  const handleResetVotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      // Delete all votes for this user and prompt
      const { error: votesError } = await supabase
        .from('votes')
        .delete()
        .eq('user_id', user.id)
        .eq('prompt_id', promptId);

      if (votesError) throw votesError;

      // Delete ranking if exists
      const { error: rankingError } = await supabase
        .from('rankings')
        .delete()
        .eq('user_id', user.id)
        .eq('prompt_id', promptId);

      if (rankingError && rankingError.code !== 'PGRST116') throw rankingError;

      // Delete/reset comparison session
      const { error: sessionError } = await supabase
        .from('comparison_sessions')
        .delete()
        .eq('user_id', user.id)
        .eq('prompt_id', promptId);

      if (sessionError && sessionError.code !== 'PGRST116') throw sessionError;

      // Remove from prompt completions
      const { error: completionError } = await supabase
        .from('prompt_completions')
        .delete()
        .eq('user_id', user.id)
        .eq('prompt_id', promptId);

      if (completionError && completionError.code !== 'PGRST116') throw completionError;

      // Reset component state
      setVoteHistory([]);
      setCompletedPairs(new Set());
      setCurrentPairIndex(0);
      setSessionId(null);

      // Reinitialize
      window.location.reload();

      toast.success("Votes reset. Starting fresh!");
    } catch (error) {
      console.error("Error resetting votes:", error);
      toast.error("Failed to reset votes");
    }
  };

  if (isLoading || !currentPair) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading comparison...</p>
      </div>
    );
  }

  // Reset images loaded state when pair changes
  useEffect(() => {
    setImagesLoaded({ left: false, right: false });
  }, [currentPairIndex]);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Comparison Tips */}
        <ComparisonTips />

        {/* Header with Progress */}
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Current Prompt</p>
            <h2 className="text-xl font-medium">{promptText}</h2>
          </div>
          
          <ProgressGamification
            completed={completedPairs.size}
            total={totalComparisons}
            showConfetti={completedPairs.size === totalComparisons}
          />

          {/* Reset Button */}
          {completedPairs.size > 0 && (
            <div className="flex justify-center pt-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    Reset My Votes
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset All Votes?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete all your votes for this prompt and restart the comparison from the beginning. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetVotes} className="bg-destructive hover:bg-destructive/90">
                      Reset All Votes
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        {/* Comparison */}
        <div className="flex gap-8 items-start">
          {!imagesLoaded.left ? (
            <ImageCardSkeleton />
          ) : null}
          <div className={!imagesLoaded.left ? 'hidden' : 'flex-1'}>
            <ImageCard
              imageUrl={currentPair.left.image_url}
              modelName={currentPair.left.model_name}
              side="left"
              isKing={false}
              onImageLoad={() => setImagesLoaded(prev => ({ ...prev, left: true }))}
            />
          </div>

          {!imagesLoaded.right ? (
            <ImageCardSkeleton />
          ) : null}
          <div className={!imagesLoaded.right ? 'hidden' : 'flex-1'}>
            <ImageCard
              imageUrl={currentPair.right.image_url}
              modelName={currentPair.right.model_name}
              side="right"
              isKing={false}
              onImageLoad={() => setImagesLoaded(prev => ({ ...prev, right: true }))}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="flex justify-center items-center gap-4">
            <Button
              onClick={() => handleSelection(currentPair.left)}
              variant="outline"
              size="lg"
              className="glass-hover gap-2"
              disabled={!imagesLoaded.left || !imagesLoaded.right}
            >
              <kbd className="px-2 py-1 bg-muted rounded text-xs">A</kbd>
              Left Wins
            </Button>
            <Button
              onClick={handleTie}
              variant="outline"
              size="lg"
              className="glass-hover gap-2"
              disabled={!imagesLoaded.left || !imagesLoaded.right}
            >
              <kbd className="px-2 py-1 bg-muted rounded text-xs">T</kbd>
              Tie
            </Button>
            <Button
              onClick={() => handleSelection(currentPair.right)}
              variant="outline"
              size="lg"
              className="glass-hover gap-2"
              disabled={!imagesLoaded.left || !imagesLoaded.right}
            >
              <kbd className="px-2 py-1 bg-muted rounded text-xs">L</kbd>
              Right Wins
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

          <p className="text-xs text-center text-muted-foreground">
            💡 Tip: Use keyboard shortcuts for faster voting
          </p>
        </div>
      </div>
    </div>
  );
};
