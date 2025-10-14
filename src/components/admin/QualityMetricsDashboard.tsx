import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { aggregateQualityMetrics, QualityMetric, UserQualityData } from '@/lib/analyticsUtils';

export default function QualityMetricsDashboard() {
  const [metrics, setMetrics] = useState<QualityMetric[]>([]);
  const [userQuality, setUserQuality] = useState<UserQualityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchQualityData();
  }, []);

  const fetchQualityData = async () => {
    try {
      const { data: rankings, error } = await supabase
        .from('rankings')
        .select('*');

      if (error) throw error;

      // Fetch user profiles to get full names
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email');

      if (profilesError) throw profilesError;

      // Create a map of user_id -> full_name (fallback to email)
      const nameMap = new Map<string, string>();
      profiles?.forEach(profile => {
        nameMap.set(profile.id, profile.full_name || profile.email);
      });
      setUserNames(nameMap);

      const aggregatedMetrics = aggregateQualityMetrics(rankings || []);
      setMetrics(aggregatedMetrics);

      // Group by user
      const userMap: Record<string, any[]> = {};
      rankings?.forEach(ranking => {
        if (!userMap[ranking.user_id]) {
          userMap[ranking.user_id] = [];
        }
        userMap[ranking.user_id].push(ranking);
      });

      // Calculate per-user quality metrics
      const userQualityData: UserQualityData[] = Object.entries(userMap).map(([userId, userRankings]) => {
        const avgConsistency = userRankings.reduce((sum, r) => sum + (r.consistency_score || 0), 0) / userRankings.length;
        const avgCertainty = userRankings.reduce((sum, r) => sum + (r.vote_certainty || 0), 0) / userRankings.length;
        const avgVoteTime = userRankings.reduce((sum, r) => sum + (r.average_vote_time_seconds || 0), 0) / userRankings.length;
        const totalTransitivity = userRankings.reduce((sum, r) => sum + (r.transitivity_violations || 0), 0);
        
        const allFlags = new Set<string>();
        userRankings.forEach(r => {
          r.quality_flags?.forEach((flag: string) => allFlags.add(flag));
        });

        return {
          userId,
          userEmail: userRankings[0].user_email,
          consistencyScore: Math.round(avgConsistency * 100) / 100,
          voteCertainty: Math.round(avgCertainty * 100) / 100,
          avgVoteTime: Math.round(avgVoteTime * 100) / 100,
          transitivityViolations: totalTransitivity,
          totalVotes: userRankings.length,
          qualityFlags: Array.from(allFlags),
        };
      }).sort((a, b) => a.consistencyScore - b.consistencyScore); // Worst first

      setUserQuality(userQualityData);
    } catch (error) {
      console.error('Error fetching quality data:', error);
      toast.error('Failed to load quality metrics');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'danger':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'good':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'danger':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Aggregate Metrics */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Platform Quality Metrics</CardTitle>
          <CardDescription>Overall voting quality across all users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics
              .filter(metric => !metric.metric.toLowerCase().includes('transitivity') && !metric.metric.toLowerCase().includes('violation'))
              .map((metric) => (
              <div key={metric.metric} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">{metric.metric}</p>
                  <p className="text-2xl font-bold">{metric.value}</p>
                </div>
                {getStatusIcon(metric.status)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Quality Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>User Quality Analysis</CardTitle>
          <CardDescription>Individual user voting patterns and quality flags</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Consistency</TableHead>
                <TableHead className="text-right">Certainty</TableHead>
                <TableHead className="text-right">Avg Time (s)</TableHead>
                <TableHead className="text-right">Total Votes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userQuality.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell className="font-medium">
                    {userNames.get(user.userId) || user.userEmail}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={user.consistencyScore >= 70 ? 'default' : user.consistencyScore >= 50 ? 'secondary' : 'destructive'}>
                      {user.consistencyScore}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{user.voteCertainty}%</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={user.avgVoteTime >= 2 && user.avgVoteTime <= 30 ? 'default' : 'secondary'}>
                      {user.avgVoteTime}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{user.totalVotes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
