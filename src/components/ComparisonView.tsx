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

type AnimationState = 'idle' | 'left-wins' | 'right-wins' | 'right-wins-exit' | 'right-wins-promote' | 'right-wins-enter';

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
  
  // Also initialize graph for any image IDs from votes that aren't in images array (swapped out)
  votes.forEach(vote => {
    if (vote.winner_id && !graph[vote.winner_id]) {
      graph[vote.winner_id] = new Set();
    }
    if (!graph[vote.left_image_id]) {
      graph[vote.left_image_id] = new Set();
    }
    if (!graph[vote.right_image_id]) {
      graph[vote.right_image_id] = new Set();
    }
  });
  
  votes.forEach(vote => {
    if (vote.is_tie || !vote.winner_id) return;
    
    const winnerId = vote.winner_id;
    const loserId = vote.left_image_id === winnerId 
      ? vote.right_image_id 
      : vote.left_image_id;
    
    // Defensive check: only add if winnerId exists in graph
    if (graph[winnerId]) {
      graph[winnerId].add(loserId);
    }
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
/**
 * Calculate common opponent score
 * If A and B never fought, but both fought C:
 * - If A beat C and B lost to C, A > B
 * - If both beat C, compare margin or Elo
 */
const getCommonOpponentScore = (
  imageAId: string,
  imageBId: string,
  h2hWins: Record<string, Record<string, number>>,
  allImages: ImageWithWins[]
): number => {
  let aAdvantage = 0;
  
  // Find all common opponents
  allImages.forEach(opponent => {
    if (opponent.id === imageAId || opponent.id === imageBId) return;
    
    const aBeatsOpponent = (h2hWins[imageAId]?.[opponent.id] || 0) > 0;
    const bBeatsOpponent = (h2hWins[imageBId]?.[opponent.id] || 0) > 0;
    const opponentBeatsA = (h2hWins[opponent.id]?.[imageAId] || 0) > 0;
    const opponentBeatsB = (h2hWins[opponent.id]?.[imageBId] || 0) > 0;
    
    // A beat opponent but B didn't → +1 for A
    if (aBeatsOpponent && !bBeatsOpponent) aAdvantage++;
    
    // B beat opponent but A didn't → -1 for A (advantage to B)
    if (bBeatsOpponent && !aBeatsOpponent) aAdvantage--;
    
    // Opponent beat B but not A → +1 for A
    if (opponentBeatsB && !opponentBeatsA) aAdvantage++;
    
    // Opponent beat A but not B → -1 for A
    if (opponentBeatsA && !opponentBeatsB) aAdvantage--;
  });
  
  return aAdvantage;
};

// Helper function to safely check for existing ranking with retry logic
const checkExistingRanking = async (userId: string, promptId: string, retries = 2): Promise<any | null> => {
  for (let i = 0; i < retries; i++) {
    try {
      const { data, error } = await supabase
        .from('rankings')
        .select('id')
        .eq('user_id', userId)
        .eq('prompt_id', promptId)
        .maybeSingle();
      
      if (error) {
        console.warn(`⚠️ Ranking check attempt ${i + 1}/${retries} failed:`, error);
        if (i === retries - 1) {
          console.log('⚠️ All ranking check attempts failed, assuming no ranking exists');
          return null; // Give up, assume no ranking
        }
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retry
        continue;
      }
      
      return data;
    } catch (err) {
      console.warn(`⚠️ Ranking check exception on attempt ${i + 1}/${retries}:`, err);
      if (i === retries - 1) {
        console.log('⚠️ All ranking check attempts failed with exception, assuming no ranking exists');
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return null;
};

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
  
  // IMPROVED SORT FUNCTION
  const result = [...rankedImages].sort((a, b) => {
    const aInCycle = inCycle.has(a.id);
    const bInCycle = inCycle.has(b.id);
    
    // 1. If both in cycle, use Elo
    if (aInCycle && bInCycle) {
      return (b.elo || 0) - (a.elo || 0);
    }
    
    // 2. Check DIRECT head-to-head record
    const aWinsVsB = h2hWins[a.id]?.[b.id] || 0;
    const bWinsVsA = h2hWins[b.id]?.[a.id] || 0;
    
    if (aWinsVsB > bWinsVsA) {
      console.log(`  ✅ ${a.model_name} ranks higher: beat ${b.model_name} directly (${aWinsVsB}-${bWinsVsA})`);
      return -1;
    }
    if (bWinsVsA > aWinsVsB) {
      console.log(`  ✅ ${b.model_name} ranks higher: beat ${a.model_name} directly (${bWinsVsA}-${aWinsVsB})`);
      return 1;
    }
    
    // 3. No direct h2h? Check COMMON OPPONENTS
    const commonOpponentScore = getCommonOpponentScore(a.id, b.id, h2hWins, rankedImages);
    if (commonOpponentScore > 0) {
      console.log(`  ✅ ${a.model_name} ranks higher: better record vs common opponents (+${commonOpponentScore})`);
      return -1;
    }
    if (commonOpponentScore < 0) {
      console.log(`  ✅ ${b.model_name} ranks higher: better record vs common opponents (${commonOpponentScore})`);
      return 1;
    }
    
    // 4. LAST RESORT: Use Elo (but log it)
    const eloDiff = (b.elo || 0) - (a.elo || 0);
    console.log(`  ⚖️ ${eloDiff > 0 ? b.model_name : a.model_name} ranks higher: Elo tiebreaker (${a.model_name}:${a.elo} vs ${b.model_name}:${b.elo})`);
    return eloDiff;
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
  
  // PHASE 2: Add debounce mechanism
  const [isTournamentCompleting, setIsTournamentCompleting] = useState(false);
  
  // Guard flag to prevent infinite loop
  const [isCompletingTournament, setIsCompletingTournament] = useState(false);
  const [skipNextChampionAnimation, setSkipNextChampionAnimation] = useState(false);
  
  const estimatedTotal = Math.ceil(images.length * 2.5);

  useEffect(() => {
    if (skipNextChampionAnimation) {
      // Reset the flag after the render cycle
      setTimeout(() => setSkipNextChampionAnimation(false), 0);
    }
  }, [skipNextChampionAnimation]);

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

        // PHASE 6: Check if prompt is already completed
        const existingRanking = await checkExistingRanking(user.id, promptId);
        
        if (existingRanking) {
          console.log('✅ Prompt already completed, auto-skipping to next prompt');
          setIsLoading(false);
          // Auto-skip to next uncompleted prompt
          toast.info("This prompt is already completed");
          setTimeout(() => {
            if (onSkip) {
              onSkip();
            }
          }, 500);
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
          const { data: newSession, error: sessionError } = await supabase
            .from('comparison_sessions')
            .upsert({
              user_id: user.id,
              prompt_id: promptId,
              total_comparisons: estimatedTotal,
              completed_comparisons: 0,
            }, {
              onConflict: 'user_id,prompt_id',
              ignoreDuplicates: false
            })
            .select()
            .single();
          
          if (sessionError) {
            console.error('❌ Error creating/updating session:', sessionError);
            throw sessionError;
          }
          
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
    if (isLoading || !champion || isTournamentCompleting) return;

    // Tournament complete when no more challengers
    if (!challenger && remainingImages.length === 0 && totalComparisons > 0) {
      console.log('🏆 Tournament complete! Champion:', champion.model_name);
      setIsTournamentCompleting(true);
      handleTournamentComplete().finally(() => {
        setTimeout(() => setIsTournamentCompleting(false), 1000);
      });
    }
  }, [challenger, remainingImages, isLoading, champion, totalComparisons, isTournamentCompleting]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = async (e: KeyboardEvent) => {
      // Ignore if focused on an input/textarea/select
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      // Ignore if images not loaded or animation in progress or vote pending
      if (!champion || !challenger || animationState !== 'idle' || pendingVote) return;

      // Only handle arrow keys
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault(); // Prevent default browser behavior (scrolling, text selection)
        
        if (e.key === "ArrowLeft") {
          await handleSelection(champion);
        } else if (e.key === "ArrowRight") {
          await handleSelection(challenger);
        }
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

  const resetVotingStateAfterTournament = () => {
    console.log('🔄 Resetting voting state after tournament...');
    setVoteCache(new Set());
    setPendingVote(false);
    setAnimationState('idle');
  };

  const handleTournamentComplete = async () => {
    if (isCompletingTournament) {
      console.log('⚠️ Tournament completion already in progress, skipping');
      return;
    }
    
    setIsCompletingTournament(true);
    
    try {
      console.log('🏆 Tournament complete! Calculating final rankings...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsCompletingTournament(false);
        return;
      }

      // PHASE 0: Check if user has already ranked this prompt
      const existingRanking = await checkExistingRanking(user.id, promptId);
      
      if (existingRanking) {
        console.log('✅ User has already ranked this prompt, skipping tournament');
        setIsCompletingTournament(false);
        return;
      }

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
      
      // Build head-to-head win records for the modal
      const h2hWins: Record<string, Record<string, number>> = {};
      rankedImages.forEach(img => {
        h2hWins[img.id] = {};
      });
      
      allVotes.forEach(vote => {
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
      
      // Pass ALL ranked images (not just top 3) with H2H relationships
      const allRankedWithH2H = rankedImages.map((img, idx) => {
        const relationships: Record<string, { wins: number; losses: number }> = {};
        
        // Calculate H2H for top 3 only (since those are the ones we display in modal)
        if (idx < 3) {
          rankedImages.slice(0, 3).forEach((other, otherIdx) => {
            if (idx !== otherIdx) {
              const winsVsOther = h2hWins[img.id]?.[other.id] || 0;
              const lossesVsOther = h2hWins[other.id]?.[img.id] || 0;
              relationships[other.id] = { wins: winsVsOther, losses: lossesVsOther };
            }
          });
        }
        
        return {
          ...img,
          inCycle: inCycle.has(img.id),
          h2hRelationships: relationships
        };
      });
      
      console.log('🏆 Final Top 3 (after h2h resolution):', allRankedWithH2H.slice(0, 3).map(img => ({ 
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

      onComplete(allRankedWithH2H);
      
      // Reset voting state to prevent stale data
      resetVotingStateAfterTournament();
    } catch (error) {
      console.error("Error completing tournament:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack');
      console.error("Context:", {
        promptId,
        imagesCount: images.length,
      });
      toast.error("Failed to calculate rankings");
      
      // Reset state even on error
      resetVotingStateAfterTournament();
    } finally {
      setIsCompletingTournament(false);
    }
  };

  // Helper: Create unique key for vote pairs (position matters in King-of-the-Hill)
  const getVotePairKey = (championId: string, challengerId: string): string => {
    return `${championId}|${challengerId}`;
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
      const animationTime = 400; // Unified animation time

      // Trigger animation before DB call
      setAnimationState(isChampionWinner ? 'left-wins' : 'right-wins-exit');

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
      
      console.log('📊 Vote recorded, updating counts:', {
        oldCount: totalComparisons,
        newCount: newComparisonCount,
        total: estimatedTotal,
        remaining: estimatedTotal - newComparisonCount
      });

      // Update session progress
      if (sessionId) {
        await supabase
          .from('comparison_sessions')
          .update({ completed_comparisons: newComparisonCount })
          .eq('id', sessionId);
      }

      // Wait for exit animation
      await new Promise(resolve => setTimeout(resolve, animationTime));

      if (isChampionWinner) {
        // Left wins: Champion defended throne, get new challenger
        console.log('🎬 Left wins: Champion defends, getting new challenger');
        if (remainingImages.length > 0) {
          setChallenger(remainingImages[0]);
          setRemainingImages(prev => prev.slice(1));
        } else {
          setChallenger(null);
        }
        
        // Reset to idle
        setAnimationState('idle');
        setPendingVote(false);
      } else {
        // Challenger wins sequence
        setSkipNextChampionAnimation(true); // Prevent re-animation
        setAnimationState('right-wins-promote');

        setTimeout(() => {
          setChampion(challenger);
          if (remainingImages.length > 0) {
            setChallenger(remainingImages[0]);
            setRemainingImages(prev => prev.slice(1));
          } else {
            setChallenger(null);
          }
          setAnimationState('right-wins-enter');

          setTimeout(() => {
            setAnimationState('idle');
            setPendingVote(false);
          }, animationTime);
        }, animationTime);
      }
      
    } catch (error: any) {
      console.error("Error saving vote:", error);
      
      if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
        console.log('⚠️ Vote already exists for this pair, continuing...');
        toast.info("You've already voted on this comparison");
      } else {
        toast.error(`Failed to save vote: ${error?.message || 'Unknown error'}`);
        setAnimationState('idle');
        setPendingVote(false);
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
        .upsert({
          user_id: user.id,
          prompt_id: promptId,
          total_comparisons: estimatedTotal,
          completed_comparisons: 0,
          started_at: new Date().toISOString(),
          completed_at: null,
        }, {
          onConflict: 'user_id,prompt_id',
          ignoreDuplicates: false
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
          {/* Champion (Left Side) - Exits left when right wins, stays when left wins */}
          <div 
            className={`flex-1 transition-all duration-300 ease-in-out ${
              animationState === 'right-wins-exit' ? 'translate-x-[-120%] opacity-0' :
              animationState === 'right-wins-promote' ? 'translate-x-0 opacity-100' : // Stay visible
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
              skipAnimation={skipNextChampionAnimation}
            />
          </div>

          {/* Challenger (Right Side) - Exits right when left wins, slides left when right wins */}
          <div 
            className={`flex-1 transition-all duration-300 ease-in-out ${
              animationState === 'left-wins' ? 'translate-x-[120%] opacity-0' :
              animationState === 'right-wins-exit' ? 'translate-x-0 opacity-100' :
              animationState === 'right-wins-promote' ? 'translate-x-[-100%]' :
              animationState === 'right-wins-enter' ? 'translate-x-0 opacity-100' :
              'translate-x-0 opacity-100'
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
