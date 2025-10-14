import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { calculateModelPerformance, exportToCSV, ModelPerformance } from '@/lib/analyticsUtils';

export default function ModelPerformanceChart() {
  const [performance, setPerformance] = useState<ModelPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const fetchPerformanceData = async () => {
    try {
      const [votesRes, rankingsRes, imagesRes] = await Promise.all([
        supabase.from('votes').select('*'),
        supabase.from('rankings').select('*'),
        supabase.from('images').select('*'),
      ]);

      if (votesRes.error) throw votesRes.error;
      if (rankingsRes.error) throw rankingsRes.error;
      if (imagesRes.error) throw imagesRes.error;

      const performanceData = calculateModelPerformance(
        votesRes.data || [],
        rankingsRes.data || [],
        imagesRes.data || []
      );

      setPerformance(performanceData);
    } catch (error) {
      console.error('Error fetching performance data:', error);
      toast.error('Failed to load model performance data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    exportToCSV(performance, 'model_performance');
    toast.success('Performance data exported to CSV');
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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Performing Model</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performance[0]?.modelName || 'N/A'}</div>
            <p className="text-xs text-muted-foreground">
              {performance[0]?.winRate.toFixed(1)}% win rate
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Ranked #1</CardTitle>
            <Badge variant="default">1st</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {[...performance].sort((a, b) => b.timesRankedFirst - a.timesRankedFirst)[0]?.modelName || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {[...performance].sort((a, b) => b.timesRankedFirst - a.timesRankedFirst)[0]?.timesRankedFirst || 0} times
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lowest Performing</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performance[performance.length - 1]?.modelName || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {performance[performance.length - 1]?.winRate.toFixed(1)}% win rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Table */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Model Performance Details</CardTitle>
              <CardDescription>Win rates, rankings, and voting statistics by model</CardDescription>
            </div>
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Wins</TableHead>
                <TableHead className="text-right">Losses</TableHead>
                <TableHead className="text-right">Ties</TableHead>
                <TableHead className="text-right">Avg Rank</TableHead>
                <TableHead className="text-right">1st Place</TableHead>
                <TableHead className="text-right">2nd Place</TableHead>
                <TableHead className="text-right">3rd Place</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {performance.map((model, index) => (
                <TableRow key={model.modelName}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {index === 0 && <Badge variant="default">Top</Badge>}
                      {model.modelName}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={model.winRate >= 60 ? 'default' : model.winRate >= 40 ? 'secondary' : 'outline'}>
                      {model.winRate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-success">{model.wins}</TableCell>
                  <TableCell className="text-right text-destructive">{model.losses}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{model.ties}</TableCell>
                  <TableCell className="text-right">{model.avgRankPosition.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{model.timesRankedFirst}</TableCell>
                  <TableCell className="text-right">{model.timesRankedSecond}</TableCell>
                  <TableCell className="text-right">{model.timesRankedThird}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
