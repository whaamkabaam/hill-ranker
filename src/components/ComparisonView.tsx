import { useEffect, useState } from "react";
import { ImageCard } from "./ImageCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import ImageCardSkeleton from "./ImageCardSkeleton";
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

interface ComparisonViewProps {
  promptId: string;
  promptText: string;
  images: Image[];
  userEmail: string;
  onComplete: (winners: ImageWithWins[]) => void;
  onSkip?: () => void;
}

type AnimationState = 'idle' | 'left-wins' | 'right-wins' | 'clearing-right' | 'entering-challenger';

// Utility: Calculate Elo ratings from votes
const calculateEloRatings = (images: Image[], votes: any[]): ImageWithWins[] => {
  const K = 32;
  const ratings: Record<string, number> = {};
  const wins: Record<string, number> = {};

  images.forEach(img => {
    ratings[img.id] = 1500;
    wins[img.id] = 0;
  });

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

/**
 * Detect circular dependencies using Tarjan's algorithm
 * Returns array of cycles (e.g., [[imgA, imgB, imgC]] means A>B>C>A)
 */
const detectCycles = (
  images: ImageWithWins[],
  votes: any[]
): string[][] => {
  // Build adjacency list where A->B means A beat B
  const graph: Record<string, Set<string>> = {};
  images.forEach(img => {
    graph[img.id] = new Set();
  });
  
  votes.forEach(vote => {
    if (vote.is_tie || !vote.winner_id) return;
    
    const winnerId = vote.winner_id;
    const loserId = vote.left_image_id === winnerId 
      ? vote.right_image_id 
      : vote.left_image_id;
    
    graph[winnerId].add(loserId);
  });
  
  // Find strongly connected components (cycles)
  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];
  
  const dfs = (nodeId: string, path: string[]) => {
    visited.add(nodeId);
    onStack.add(nodeId);
    path.push(nodeId);
    
    const neighbors = graph[nodeId] || new Set();
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        dfs(neighborId, [...path]);
      } else if (onStack.has(neighborId)) {
        // Found a cycle!
        const cycleStart = path.indexOf(neighborId);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart);
          if (cycle.length > 1) {
            cycles.push(cycle);
          }
        }
      }
    }
    
    onStack.delete(nodeId);
  };
  
  images.forEach(img => {
    if (!visited.has(img.id)) {
      dfs(img.id, []);
    }
  });
  
  return cycles;
};

/**
 * Resolve rankings using graph-based approach with cycle detection
 * Handles circular dependencies by using Elo as tiebreaker within cycles
 */
const resolveRankingsWithCycles = (
  rankedImages: ImageWithWins[],
  votes: any[]
): ImageWithWins[] => {
  console.log('🔧 Resolving rankings with cycle detection...');
  console.log('📊 Initial ranked images:', rankedImages.map(img => ({
    model: img.model_name,
    wins: img.wins,
    elo: img.elo
  })));
  
  // Detect circular dependencies
  const cycles = detectCycles(rankedImages, votes);
  const inCycle = new Set<string>();
  
  cycles.forEach(cycle => {
    const modelNames = cycle.map(id => {
      const img = rankedImages.find(i => i.id === id);
      return img?.model_name || id;
    });
    console.log(`⚠️ Circular dependency detected: ${modelNames.join(' → ')} → ${modelNames[0]}`);
    console.log('   Using Elo scores to break the cycle.');
    cycle.forEach(id => inCycle.add(id));
  });
  
  // Build adjacency list for head-to-head wins
  const h2hWins: Record<string, Record<string, number>> = {};
  rankedImages.forEach(img => {
    h2hWins[img.id] = {};
  });
  
  votes.forEach(vote => {
    if (vote.is_tie || !vote.winner_id) return;
    
    const winnerId = vote.winner_id;
    const loserId = vote.left_image_id === winnerId 
      ? vote.right_image_id 
      : vote.left_image_id;
    
    if (!h2hWins[winnerId][loserId]) {
      h2hWins[winnerId][loserId] = 0;
    }
    h2hWins[winnerId][loserId]++;
  });
  
  // Custom sort function
  const result = [...rankedImages].sort((a, b) => {
    // Check if both are in a cycle together
    const aInCycle = inCycle.has(a.id);
    const bInCycle = inCycle.has(b.id);
    
    // If both in cycle, use Elo
    if (aInCycle && bInCycle) {
      return (b.elo || 0) - (a.elo || 0);
    }
    
    // Check head-to-head record (only if not in cycle)
    const aWinsVsB = h2hWins[a.id]?.[b.id] || 0;
    const bWinsVsA = h2hWins[b.id]?.[a.id] || 0;
    
    if (aWinsVsB > bWinsVsA) return -1; // a should rank higher
    if (bWinsVsA > aWinsVsB) return 1;  // b should rank higher
    
    // If head-to-head is tied or no direct comparison, use Elo
    return (b.elo || 0) - (a.elo || 0);
  });
  
  console.log('✅ Ranking resolution complete');
  console.log('📊 Final ranked images:', result.map(img => ({
    model: img.model_name,
    wins: img.wins,
    elo: img.elo,
    inCycle: inCycle.has(img.id)
  })));
  
  return result;
};

export const ComparisonView = ({
  promptId,
  promptText,
  images,
  userEmail,
  onComplete,
  onSkip,
}: ComparisonViewProps) => {
  // King-of-the-Hill state
  const [champion, setChampion] = useState<Image | null>(null);
  const [challenger, setChallenger] = useState<Image | null>(null);
  const [remainingImages, setRemainingImages] = useState<Image[]>([]);
  const [totalComparisons, setTotalComparisons] = useState(0);
  const [animationState, setAnimationState] = useState<AnimationState>('idle');
  
  // Session state
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });
  
  // Vote deduplication state
  const [pendingVote, setPendingVote] = useState<boolean>(false);
  const [voteCache, setVoteCache] = useState<Set<string>>(new Set());
  
  const estimatedTotal = Math.ceil(images.length * 2.5);

  // Initialize King-of-the-Hill tournament
  useEffect(() => {
    const initialize = async () => {
      if (images.length < 2) {
        toast.error(`Need at least 2 images to compare (found ${images.length})`);
        setIsLoading(false);
        return;
      }

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
          .maybeSingle();

        if (existingSession) {
          setSessionId(existingSession.id);
        } else {
          const { data: newSession } = await supabase
            .from('comparison_sessions')
            .insert({
              user_id: user.id,
              prompt_id: promptId,
              total_comparisons: estimatedTotal,
              completed_comparisons: 0,
            })
            .select()
            .single();
          
          if (newSession) {
            setSessionId(newSession.id);
          }
        }

        // Load existing votes
        const { data: existingVotes } = await supabase
          .from('votes')
          .select('*')
          .eq('prompt_id', promptId)
          .eq('user_id', user.id);

        if (existingVotes && existingVotes.length > 0) {
          // Populate vote cache with existing votes
          const cache = new Set<string>();
          existingVotes.forEach(vote => {
            const key = getVotePairKey(vote.left_image_id, vote.right_image_id);
            cache.add(key);
          });
          setVoteCache(cache);
          
          // Reconstruct state from votes
          const usedImages = new Set<string>();
          
          existingVotes.forEach(vote => {
            usedImages.add(vote.left_image_id);
            usedImages.add(vote.right_image_id);
          });

          // Calculate current rankings to determine champion
          const rankedImages = calculateEloRatings(images, existingVotes);
          const currentChamp = rankedImages[0];
          
          // Find images not yet used
          const unused = images.filter(img => !usedImages.has(img.id));
          
          setChampion(currentChamp);
          setChallenger(unused.length > 0 ? unused[0] : null);
          setRemainingImages(unused.slice(1));
          setTotalComparisons(existingVotes.length);
          
          toast.info(`Resuming: ${existingVotes.length} comparisons completed`);
        } else {
          // Fresh start
          setChampion(images[0]);
          setChallenger(images[1]);
          setRemainingImages(images.slice(2));
          setTotalComparisons(0);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Error initializing tournament:", error);
        toast.error("Failed to load comparison state");
        setIsLoading(false);
      }
    };

    initialize();
  }, [images, promptId]);

  // Check for tournament completion
  useEffect(() => {
    if (isLoading || !champion) return;

    // Tournament complete when no more challengers
    if (!challenger && remainingImages.length === 0 && totalComparisons > 0) {
      console.log('🏆 Tournament complete! Champion:', champion.model_name);
      handleTournamentComplete();
    }
  }, [challenger, remainingImages, isLoading, champion, totalComparisons]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = async (e: KeyboardEvent) => {
      if (!champion || !challenger || animationState !== 'idle') return;

      if (e.key === "ArrowLeft") {
        await handleSelection(champion);
      } else if (e.key === "ArrowRight") {
        await handleSelection(challenger);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [champion, challenger, animationState]);

  // Reset images loaded state when images change
  useEffect(() => {
    setImagesLoaded({ left: false, right: false });
  }, [champion?.id, challenger?.id]);

  // Check if images are already cached
  useEffect(() => {
    if (!champion || !challenger) return;
    
    const checkImageLoaded = (url: string, side: 'left' | 'right') => {
      const img = new Image();
      img.src = url;
      if (img.complete) {
        setImagesLoaded(prev => ({ ...prev, [side]: true }));
      }
    };
    
    checkImageLoaded(champion.image_url, 'left');
    checkImageLoaded(challenger.image_url, 'right');
  }, [champion, challenger]);

  const handleTournamentComplete = async () => {
    try {
      console.log('🏆 Tournament complete! Calculating final rankings...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: allVotes } = await supabase
        .from('votes')
        .select('*')
        .eq('prompt_id', promptId)
        .eq('user_id', user.id);

      if (!allVotes || allVotes.length === 0) {
        toast.error("No votes recorded");
        return;
      }

      // Calculate final rankings from all votes
      let rankedImages = calculateEloRatings(images, allVotes);
      
      console.log('📊 Elo rankings:', rankedImages.map(img => ({ 
        model: img.model_name, 
        elo: img.elo, 
        wins: img.wins 
      })));
      
      // Detect cycles to pass to modal
      const cycles = detectCycles(rankedImages, allVotes);
      const inCycle = new Set<string>();
      cycles.forEach(cycle => cycle.forEach(id => inCycle.add(id)));
      
      // Resolve using graph-based approach (handles cycles)
      rankedImages = resolveRankingsWithCycles(rankedImages, allVotes);
      
      if (rankedImages.length < 3) {
        toast.error(`Only ${rankedImages.length} images available, need at least 3`);
        return;
      }
      
      const top3 = rankedImages.slice(0, 3).map(img => ({
        ...img,
        inCycle: inCycle.has(img.id)
      }));
      
      console.log('🏆 Final Top 3 (after h2h resolution):', top3.map(img => ({ 
        model: img.model_name, 
        elo: img.elo, 
        wins: img.wins,
        inCycle: img.inCycle 
      })));

      // Update session as completed
      if (sessionId) {
        await supabase
          .from('comparison_sessions')
          .update({
            completed_at: new Date().toISOString(),
            completed_comparisons: totalComparisons,
          })
          .eq('id', sessionId);
      }

      onComplete(top3);
    } catch (error) {
      console.error("Error completing tournament:", error);
      toast.error("Failed to calculate rankings");
    }
  };

  // Helper: Create unique key for vote pairs (always sorted)
  const getVotePairKey = (img1Id: string, img2Id: string): string => {
    return [img1Id, img2Id].sort().join('|');
  };

  // Helper: Check if already voted on this pair
  const hasVotedOnPair = (img1Id: string, img2Id: string): boolean => {
    const key = getVotePairKey(img1Id, img2Id);
    return voteCache.has(key);
  };

  const handleSelection = async (winner: Image) => {
    if (!champion || !challenger || animationState !== 'idle') return;

    // Block duplicate votes
    if (pendingVote || hasVotedOnPair(champion.id, challenger.id)) {
      console.log('⏸️ Vote blocked: Already processing or voted on this pair');
      return;
    }

    // Lock voting immediately
    setPendingVote(true);
    const pairKey = getVotePairKey(champion.id, challenger.id);
    setVoteCache(prev => new Set(prev).add(pairKey));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to vote");
        setPendingVote(false);
        return;
      }

      const isChampionWinner = winner.id === champion.id;
      
      // Trigger animation
      setAnimationState(isChampionWinner ? 'left-wins' : 'right-wins');

      // Record vote (champion is always on left, challenger on right)
      const { error } = await supabase.from("votes").insert({
        prompt_id: promptId,
        user_email: userEmail,
        user_id: user.id,
        left_image_id: champion.id,
        right_image_id: challenger.id,
        winner_id: winner.id,
        is_tie: false,
      });

      if (error) throw error;

      const newComparisonCount = totalComparisons + 1;
      setTotalComparisons(newComparisonCount);

      // Update session progress
      if (sessionId) {
        await supabase
          .from('comparison_sessions')
          .update({ completed_comparisons: newComparisonCount })
          .eq('id', sessionId);
      }

      // Wait for animation to complete
      await new Promise(resolve => setTimeout(resolve, 600));

      // Update images based on winner
      if (isChampionWinner) {
        // Champion wins: stays on left, get new challenger
        if (remainingImages.length > 0) {
          setChallenger(remainingImages[0]);
          setRemainingImages(prev => prev.slice(1));
        } else {
          // No more challengers - tournament complete
          setChallenger(null);
        }
        
        // Reset animation
        setAnimationState('idle');
        setPendingVote(false);
      } else {
        // Challenger wins: 4-phase animation
        console.log('🎬 Animation Phase 1: Exit animation (right-wins) - 600ms');
        // Exit animation already triggered by setAnimationState('right-wins') at line 369
        // Already waited 600ms at line 396
        
        // PHASE 2: Clear right side and update champion
        console.log('🎬 Animation Phase 2: Clearing right side');
        setAnimationState('clearing-right');
        
        // Small delay to ensure React processes the state change
        await new Promise(resolve => setTimeout(resolve, 16)); // 1 frame
        
        // Now update the champion (left side gets the old challenger)
        console.log('🎬 Animation Phase 3: Promoting challenger to champion');
        setChampion(challenger);
        
        if (remainingImages.length > 0) {
          // PHASE 3: Prepare new challenger entry
          console.log('🎬 Animation Phase 4: Preparing new challenger');
          setAnimationState('entering-challenger');
          
          // Small delay to ensure DOM updates with new champion
          await new Promise(resolve => setTimeout(resolve, 16)); // 1 frame
          
          // Set new challenger (will be positioned off-screen)
          setChallenger(remainingImages[0]);
          setRemainingImages(prev => prev.slice(1));
          
          // Small delay to ensure new image is mounted
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // PHASE 4: Trigger enter animation
          console.log('🎬 Animation Phase 5: Enter animation (idle) - 500ms');
          setAnimationState('idle');
          
          // Wait for enter animation to complete
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          // No more challengers - tournament complete
          setChallenger(null);
          setAnimationState('idle');
        }
        
        setPendingVote(false);
      }
    } catch (error: any) {
      console.error("Error saving vote:", error);
      
      if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
        // This pair was already voted on - continue gracefully
        console.log('⚠️ Vote already exists for this pair, continuing...');
        toast.info("You've already voted on this comparison");
      } else {
        toast.error(`Failed to save vote: ${error?.message || 'Unknown error'}`);
        // Reset state so user can try again
        setAnimationState('idle');
        setPendingVote(false);
        // Remove from cache since vote failed
        setVoteCache(prev => {
          const newCache = new Set(prev);
          newCache.delete(pairKey);
          return newCache;
        });
        return;
      }
    }
  };

  const handleResetVotes = async () => {
    try {
      console.log('🔄 Starting vote reset...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      // Delete votes
      console.log('🗑️ Deleting votes...');
      const { error: votesError } = await supabase
        .from('votes')
        .delete()
        .eq('user_id', user.id)
        .eq('prompt_id', promptId);

      if (votesError) {
        console.error('❌ Error deleting votes:', votesError);
        if (votesError.code === '42501') {
          toast.error("Permission denied: Unable to delete votes. Please contact support.");
        } else {
          toast.error(`Failed to delete votes: ${votesError.message}`);
        }
        throw votesError;
      }

      // Add a small delay to ensure deletion completes
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify votes are actually deleted
      console.log('✅ Verifying votes deletion...');
      const { data: remainingVotes, error: verifyError } = await supabase
        .from('votes')
        .select('id')
        .eq('user_id', user.id)
        .eq('prompt_id', promptId);

      if (verifyError) {
        console.error('❌ Error verifying deletion:', verifyError);
        throw verifyError;
      }

      if (remainingVotes && remainingVotes.length > 0) {
        console.error('❌ Votes still exist after deletion!', remainingVotes.length);
        throw new Error('Failed to delete all votes');
      }

      console.log('✅ All votes deleted successfully');

      // Delete ranking if exists
      console.log('🗑️ Deleting ranking...');
      const { error: rankingError } = await supabase
        .from('rankings')
        .delete()
        .eq('user_id', user.id)
        .eq('prompt_id', promptId);

      if (rankingError && rankingError.code !== 'PGRST116') {
        console.error('❌ Error deleting ranking:', rankingError);
        throw rankingError;
      }
      console.log('✅ Ranking deleted');

      // Delete/reset comparison session
      console.log('🗑️ Deleting session...');
      const { error: sessionError } = await supabase
        .from('comparison_sessions')
        .delete()
        .eq('user_id', user.id)
        .eq('prompt_id', promptId);

      if (sessionError && sessionError.code !== 'PGRST116') {
        console.error('❌ Error deleting session:', sessionError);
        throw sessionError;
      }
      console.log('✅ Session deleted');

      // Remove from prompt completions
      console.log('🗑️ Deleting completions...');
      const { error: completionError } = await supabase
        .from('prompt_completions')
        .delete()
        .eq('user_id', user.id)
        .eq('prompt_id', promptId);

      if (completionError && completionError.code !== 'PGRST116') {
        console.error('❌ Error deleting completion:', completionError);
        throw completionError;
      }
      console.log('✅ Completion deleted');

      // Reset state
      console.log('🔄 Resetting component state...');
      setTotalComparisons(0);
      setSessionId(null);
      setVoteCache(new Set());
      setPendingVote(false);
      
      // Reset to fresh King-of-the-Hill state
      setChampion(images[0]);
      setChallenger(images[1]);
      setRemainingImages(images.slice(2));
      
      // Create new session
      console.log('✨ Creating new session...');
      const { data: newSession, error: newSessionError } = await supabase
        .from('comparison_sessions')
        .insert({
          user_id: user.id,
          prompt_id: promptId,
          total_comparisons: estimatedTotal,
          completed_comparisons: 0,
        })
        .select()
        .single();
      
      if (newSessionError) {
        console.error('❌ Error creating new session:', newSessionError);
        throw newSessionError;
      }
      
      if (newSession) {
        setSessionId(newSession.id);
        console.log('✅ New session created:', newSession.id);
      }
      
      console.log('✅ Vote reset complete!');
      toast.success("Votes reset. Starting fresh!");
    } catch (error) {
      console.error("❌ Error resetting votes:", error);
      toast.error("Failed to reset votes");
    }
  };

  if (isLoading || !champion || !challenger) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading comparison...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header with Progress */}
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Current Prompt</p>
            <h2 className="text-xl font-medium">{promptText}</h2>
          </div>
          
          <ProgressGamification
            completed={totalComparisons}
            total={estimatedTotal}
            showConfetti={!challenger && remainingImages.length === 0}
          />

          {/* DEBUG: Show animation state */}
          {process.env.NODE_ENV === 'development' && (
            <div className="fixed top-4 right-4 bg-black/80 text-white px-4 py-2 rounded text-sm font-mono z-50">
              State: {animationState}
            </div>
          )}

          {/* Reset Button */}
          {totalComparisons > 0 && (
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
        <div className="flex gap-8 items-start relative overflow-hidden">
          {/* Champion (Left Side) */}
          <div 
            className={`flex-1 transition-all duration-500 ease-out ${
              animationState === 'right-wins' ? '-translate-x-[120%] opacity-0' : 
              animationState === 'clearing-right' ? '-translate-x-[120%] opacity-0' :
              animationState === 'entering-challenger' ? 'translate-x-0 opacity-100' :
              'translate-x-0 opacity-100'
            }`}
          >
            {!imagesLoaded.left && (
              <div className="absolute inset-0 z-10 pointer-events-none">
                <ImageCardSkeleton />
              </div>
            )}
            <ImageCard
              imageUrl={champion.image_url}
              modelName={champion.model_name}
              side="left"
              isKing={true}
              onImageLoad={() => setImagesLoaded(prev => ({ ...prev, left: true }))}
              blindMode={true}
            />
          </div>

          {/* Challenger (Right Side) */}
          <div 
            className={`flex-1 transition-all duration-500 ease-out ${
              animationState === 'left-wins' ? 'translate-x-[120%] opacity-0' :           // Exit right when left wins
              animationState === 'right-wins' ? '-translate-x-[calc(100%+2rem)]' :       // Shift to left when right wins
              animationState === 'clearing-right' ? 'opacity-0' :                         // Hide immediately (no transform)
              animationState === 'entering-challenger' ? 'translate-x-[120%] opacity-0' : // Position off-screen right
              'translate-x-0 opacity-100'                                                  // Default: visible at right position
            }`}
          >
            {!imagesLoaded.right && (
              <div className="absolute inset-0 z-10 pointer-events-none">
                <ImageCardSkeleton />
              </div>
            )}
            <ImageCard
              imageUrl={challenger.image_url}
              modelName={challenger.model_name}
              side="right"
              isKing={false}
              onImageLoad={() => setImagesLoaded(prev => ({ ...prev, right: true }))}
              blindMode={true}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="flex justify-center items-center gap-6">
            <Button
              onClick={() => handleSelection(champion)}
              variant="outline"
              size="lg"
              className="glass-hover gap-3 min-w-[200px] hover:border-primary/50 transition-all"
              disabled={
                !imagesLoaded.left || 
                !imagesLoaded.right || 
                animationState !== 'idle' ||
                pendingVote ||
                hasVotedOnPair(champion?.id || '', challenger?.id || '')
              }
            >
              <kbd className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-lg font-bold shadow-md hover:scale-110 transition-transform">←</kbd>
              <span className="font-semibold">Champion Wins</span>
            </Button>
            <Button
              onClick={() => handleSelection(challenger)}
              variant="outline"
              size="lg"
              className="glass-hover gap-3 min-w-[200px] hover:border-primary/50 transition-all"
              disabled={
                !imagesLoaded.left || 
                !imagesLoaded.right || 
                animationState !== 'idle' ||
                pendingVote ||
                hasVotedOnPair(champion?.id || '', challenger?.id || '')
              }
            >
              <span className="font-semibold">Challenger Wins</span>
              <kbd className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-lg font-bold shadow-md hover:scale-110 transition-transform">→</kbd>
            </Button>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {remainingImages.length} challengers remaining
            </div>
            
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
