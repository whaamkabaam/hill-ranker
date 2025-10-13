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

  if (isLoading || !currentPair) {
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
              <span className="text-muted-foreground">Round-Robin Progress</span>
              <span className="font-medium">{completedPairs.size} / {totalComparisons}</span>
            </div>
            <Progress value={(completedPairs.size / totalComparisons) * 100} />
            <p className="text-xs text-muted-foreground text-center">
              Every image compared against every other image
            </p>
          </div>
        </div>

        {/* Comparison */}
        <div className="flex gap-8 items-start">
          <ImageCard
            imageUrl={currentPair.left.image_url}
            modelName={currentPair.left.model_name}
            side="left"
            isKing={false}
          />
          <ImageCard
            imageUrl={currentPair.right.image_url}
            modelName={currentPair.right.model_name}
            side="right"
            isKing={false}
          />
        </div>

        {/* Controls */}
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="flex justify-center items-center gap-4">
            <Button
              onClick={() => handleSelection(currentPair.left)}
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
              onClick={() => handleSelection(currentPair.right)}
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
