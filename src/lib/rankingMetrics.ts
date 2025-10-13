// Ranking Quality Metrics Utilities

interface Vote {
  id: string;
  left_image_id: string;
  right_image_id: string;
  winner_id: string | null;
  is_tie: boolean;
  created_at: string;
}

interface QualityMetrics {
  consistencyScore: number;
  transitivityViolations: number;
  voteCertainty: number;
  averageVoteTime: number;
  qualityFlags: string[];
}

/**
 * Calculate transitivity violations
 * If A > B and B > C, then A should > C (not C > A)
 */
export const calculateTransitivityViolations = (votes: Vote[]): number => {
  const winMatrix: Record<string, Set<string>> = {};
  
  // Build win matrix (winner -> set of losers)
  votes.forEach(vote => {
    if (vote.is_tie || !vote.winner_id) return;
    
    const winnerId = vote.winner_id;
    const loserId = vote.left_image_id === winnerId 
      ? vote.right_image_id 
      : vote.left_image_id;
    
    if (!winMatrix[winnerId]) winMatrix[winnerId] = new Set();
    winMatrix[winnerId].add(loserId);
  });
  
  let violations = 0;
  
  // Check for transitivity: if A > B and B > C, check if C > A exists
  Object.keys(winMatrix).forEach(a => {
    winMatrix[a].forEach(b => {
      if (winMatrix[b]) {
        winMatrix[b].forEach(c => {
          // If A > B > C, but C > A exists, that's a violation
          if (winMatrix[c]?.has(a)) {
            violations++;
          }
        });
      }
    });
  });
  
  return violations;
};

/**
 * Calculate consistency score based on transitivity
 * Higher score = more consistent voting
 */
export const calculateConsistencyScore = (votes: Vote[]): number => {
  if (votes.length < 3) return 100;
  
  const violations = calculateTransitivityViolations(votes);
  const maxPossibleViolations = Math.max(1, votes.length);
  
  // Convert to percentage (fewer violations = higher score)
  const score = Math.max(0, 100 - (violations / maxPossibleViolations) * 100);
  return Math.round(score * 100) / 100;
};

/**
 * Calculate vote certainty based on tie rate and decision clarity
 */
export const calculateVoteCertainty = (votes: Vote[]): number => {
  if (votes.length === 0) return 0;
  
  const tieCount = votes.filter(v => v.is_tie).length;
  const decisiveVotes = votes.length - tieCount;
  
  // Higher certainty when more decisive votes (fewer ties)
  const tieRate = tieCount / votes.length;
  const certainty = (1 - tieRate) * 100;
  
  return Math.round(certainty * 100) / 100;
};

/**
 * Calculate average time per vote in seconds
 */
export const calculateAverageVoteTime = (votes: Vote[]): number => {
  if (votes.length < 2) return 0;
  
  const sortedVotes = [...votes].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  let totalTime = 0;
  for (let i = 1; i < sortedVotes.length; i++) {
    const timeDiff = 
      new Date(sortedVotes[i].created_at).getTime() - 
      new Date(sortedVotes[i - 1].created_at).getTime();
    totalTime += timeDiff;
  }
  
  const averageMs = totalTime / (sortedVotes.length - 1);
  return Math.round((averageMs / 1000) * 100) / 100;
};

/**
 * Detect quality issues with voting patterns
 */
export const detectQualityIssues = (
  votes: Vote[],
  averageVoteTime: number,
  consistencyScore: number
): string[] => {
  const flags: string[] = [];
  
  // Too fast - likely random clicking (less than 2 seconds per vote)
  if (averageVoteTime < 2 && votes.length > 3) {
    flags.push('too_fast');
  }
  
  // Too slow - possibly distracted (more than 60 seconds per vote)
  if (averageVoteTime > 60 && votes.length > 3) {
    flags.push('too_slow');
  }
  
  // Low consistency - contradictory votes
  if (consistencyScore < 50) {
    flags.push('low_consistency');
  }
  
  // Very low consistency - possibly random
  if (consistencyScore < 30) {
    flags.push('random_voting');
  }
  
  // Too many ties (more than 50%)
  const tieRate = votes.filter(v => v.is_tie).length / votes.length;
  if (tieRate > 0.5 && votes.length > 5) {
    flags.push('high_tie_rate');
  }
  
  // All ties
  if (tieRate === 1 && votes.length > 2) {
    flags.push('all_ties');
  }
  
  return flags;
};

/**
 * Calculate all quality metrics at once
 */
export const calculateQualityMetrics = (votes: Vote[]): QualityMetrics => {
  const consistencyScore = calculateConsistencyScore(votes);
  const transitivityViolations = calculateTransitivityViolations(votes);
  const voteCertainty = calculateVoteCertainty(votes);
  const averageVoteTime = calculateAverageVoteTime(votes);
  const qualityFlags = detectQualityIssues(votes, averageVoteTime, consistencyScore);
  
  return {
    consistencyScore,
    transitivityViolations,
    voteCertainty,
    averageVoteTime,
    qualityFlags,
  };
};
