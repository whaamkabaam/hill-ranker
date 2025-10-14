// Analytics utility functions for data aggregation and export

export interface ModelPerformance {
  modelName: string;
  totalVotes: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  avgRankPosition: number;
  timesRankedFirst: number;
  timesRankedSecond: number;
  timesRankedThird: number;
}

export interface QualityMetric {
  metric: string;
  value: number;
  status: 'good' | 'warning' | 'danger';
}

export interface UserQualityData {
  userId: string;
  userEmail: string;
  consistencyScore: number;
  voteCertainty: number;
  avgVoteTime: number;
  transitivityViolations: number;
  totalVotes: number;
  qualityFlags: string[];
}

/**
 * Export data to CSV format
 */
export const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Handle values that contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Calculate model performance from votes
 */
export const calculateModelPerformance = (
  votes: any[],
  rankings: any[],
  images: any[]
): ModelPerformance[] => {
  const modelStats: Record<string, {
    wins: number;
    losses: number;
    ties: number;
    rankPositions: number[];
    firstPlace: number;
    secondPlace: number;
    thirdPlace: number;
  }> = {};

  // Initialize stats for all models
  images.forEach(image => {
    if (!modelStats[image.model_name]) {
      modelStats[image.model_name] = {
        wins: 0,
        losses: 0,
        ties: 0,
        rankPositions: [],
        firstPlace: 0,
        secondPlace: 0,
        thirdPlace: 0,
      };
    }
  });

  // Process votes
  votes.forEach(vote => {
    const leftImage = images.find(img => img.id === vote.left_image_id);
    const rightImage = images.find(img => img.id === vote.right_image_id);
    
    if (!leftImage || !rightImage) return;

    if (vote.is_tie) {
      modelStats[leftImage.model_name].ties++;
      modelStats[rightImage.model_name].ties++;
    } else if (vote.winner_id === vote.left_image_id) {
      modelStats[leftImage.model_name].wins++;
      modelStats[rightImage.model_name].losses++;
    } else if (vote.winner_id === vote.right_image_id) {
      modelStats[rightImage.model_name].wins++;
      modelStats[leftImage.model_name].losses++;
    }
  });

  // Process rankings
  rankings.forEach(ranking => {
    const first = images.find(img => img.id === ranking.first_id);
    const second = images.find(img => img.id === ranking.second_id);
    const third = images.find(img => img.id === ranking.third_id);

    if (first) {
      modelStats[first.model_name].rankPositions.push(1);
      modelStats[first.model_name].firstPlace++;
    }
    if (second) {
      modelStats[second.model_name].rankPositions.push(2);
      modelStats[second.model_name].secondPlace++;
    }
    if (third) {
      modelStats[third.model_name].rankPositions.push(3);
      modelStats[third.model_name].thirdPlace++;
    }
  });

  // Calculate aggregates
  return Object.entries(modelStats).map(([modelName, stats]) => {
    const totalVotes = stats.wins + stats.losses + stats.ties;
    const winRate = totalVotes > 0 ? (stats.wins / totalVotes) * 100 : 0;
    const avgRankPosition = stats.rankPositions.length > 0
      ? stats.rankPositions.reduce((a, b) => a + b, 0) / stats.rankPositions.length
      : 0;

    return {
      modelName,
      totalVotes,
      wins: stats.wins,
      losses: stats.losses,
      ties: stats.ties,
      winRate: Math.round(winRate * 100) / 100,
      avgRankPosition: Math.round(avgRankPosition * 100) / 100,
      timesRankedFirst: stats.firstPlace,
      timesRankedSecond: stats.secondPlace,
      timesRankedThird: stats.thirdPlace,
    };
  }).sort((a, b) => b.winRate - a.winRate);
};

/**
 * Aggregate quality metrics across all users
 */
export const aggregateQualityMetrics = (rankings: any[]): QualityMetric[] => {
  if (rankings.length === 0) {
    return [];
  }

  const avgConsistency = rankings.reduce((sum, r) => sum + (r.consistency_score || 0), 0) / rankings.length;
  const avgCertainty = rankings.reduce((sum, r) => sum + (r.vote_certainty || 0), 0) / rankings.length;
  const avgVoteTime = rankings.reduce((sum, r) => sum + (r.average_vote_time_seconds || 0), 0) / rankings.length;
  const avgTransitivity = rankings.reduce((sum, r) => sum + (r.transitivity_violations || 0), 0) / rankings.length;

  const tooFast = rankings.filter(r => (r.average_vote_time_seconds || 0) < 2).length;
  const tooSlow = rankings.filter(r => (r.average_vote_time_seconds || 0) > 60).length;
  const lowConsistency = rankings.filter(r => (r.consistency_score || 0) < 50).length;

  return [
    {
      metric: 'Average Consistency Score',
      value: Math.round(avgConsistency * 100) / 100,
      status: avgConsistency >= 70 ? 'good' : avgConsistency >= 50 ? 'warning' : 'danger',
    },
    {
      metric: 'Average Vote Certainty',
      value: Math.round(avgCertainty * 100) / 100,
      status: avgCertainty >= 80 ? 'good' : avgCertainty >= 60 ? 'warning' : 'danger',
    },
    {
      metric: 'Average Vote Time (seconds)',
      value: Math.round(avgVoteTime * 100) / 100,
      status: avgVoteTime >= 3 && avgVoteTime <= 30 ? 'good' : avgVoteTime >= 2 ? 'warning' : 'danger',
    },
    {
      metric: 'Average Transitivity Violations',
      value: Math.round(avgTransitivity * 100) / 100,
      status: avgTransitivity === 0 ? 'good' : avgTransitivity <= 2 ? 'warning' : 'danger',
    },
    {
      metric: 'Users Voting Too Fast',
      value: tooFast,
      status: tooFast === 0 ? 'good' : tooFast <= 2 ? 'warning' : 'danger',
    },
    {
      metric: 'Users Voting Too Slow',
      value: tooSlow,
      status: tooSlow === 0 ? 'good' : tooSlow <= 2 ? 'warning' : 'danger',
    },
    {
      metric: 'Users with Low Consistency',
      value: lowConsistency,
      status: lowConsistency === 0 ? 'good' : lowConsistency <= 2 ? 'warning' : 'danger',
    },
  ];
};
