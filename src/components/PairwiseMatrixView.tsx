import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Grid3x3 } from 'lucide-react';

interface HeatmapCell {
  model1: string;
  model2: string;
  model1Wins: number;
  model2Wins: number;
  ties: number;
  total: number;
  winRate: number;
}

export function PairwiseMatrixView() {
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHeatmapData();
  }, []);

  const fetchHeatmapData = async () => {
    try {
      const [votesRes, imagesRes] = await Promise.all([
        supabase.from('votes').select('*'),
        supabase.from('images').select('*'),
      ]);

      if (votesRes.error) throw votesRes.error;
      if (imagesRes.error) throw imagesRes.error;

      const votes = votesRes.data || [];
      const images = imagesRes.data || [];

      const uniqueModels = Array.from(new Set(images.map(img => img.model_name))).sort();
      setModels(uniqueModels);

      const heatmap: HeatmapCell[] = [];

      for (let i = 0; i < uniqueModels.length; i++) {
        for (let j = i + 1; j < uniqueModels.length; j++) {
          const model1 = uniqueModels[i];
          const model2 = uniqueModels[j];

          let model1Wins = 0;
          let model2Wins = 0;
          let ties = 0;

          votes.forEach(vote => {
            const leftImage = images.find(img => img.id === vote.left_image_id);
            const rightImage = images.find(img => img.id === vote.right_image_id);

            if (!leftImage || !rightImage) return;

            const isModel1Left = leftImage.model_name === model1;
            const isModel2Right = rightImage.model_name === model2;
            const isModel2Left = leftImage.model_name === model2;
            const isModel1Right = rightImage.model_name === model1;

            if ((isModel1Left && isModel2Right) || (isModel2Left && isModel1Right)) {
              if (vote.is_tie) {
                ties++;
              } else {
                const winnerImage = images.find(img => img.id === vote.winner_id);
                if (winnerImage?.model_name === model1) {
                  model1Wins++;
                } else if (winnerImage?.model_name === model2) {
                  model2Wins++;
                }
              }
            }
          });

          const total = model1Wins + model2Wins + ties;
          const winRate = total > 0 ? (model1Wins / total) * 100 : 0;

          heatmap.push({
            model1,
            model2,
            model1Wins,
            model2Wins,
            ties,
            total,
            winRate: Math.round(winRate * 100) / 100,
          });
        }
      }

      setHeatmapData(heatmap);
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
      toast.error('Failed to load pairwise comparison data');
    } finally {
      setLoading(false);
    }
  };

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 60) return 'bg-success/20 border-success/50 text-success';
    if (winRate >= 45 && winRate <= 55) return 'bg-warning/20 border-warning/50 text-warning';
    if (winRate <= 40) return 'bg-destructive/20 border-destructive/50 text-destructive';
    return 'bg-muted border-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid3x3 className="h-5 w-5 text-primary" />
          Pairwise Comparison Matrix
        </CardTitle>
        <CardDescription>
          Head-to-head model performance: See which models win when directly compared
        </CardDescription>
      </CardHeader>
      <CardContent>
        {heatmapData.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No comparison data available yet. Complete more rankings to see the matrix!
          </p>
        ) : (
          <div className="space-y-6">
            {models.map((model1, i) => (
              <div key={model1} className="space-y-3">
                <h3 className="font-semibold text-lg sticky top-0 bg-background/95 backdrop-blur-sm py-2 border-b">
                  {model1}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {models.slice(i + 1).map((model2) => {
                    const cell = heatmapData.find(
                      c => c.model1 === model1 && c.model2 === model2
                    );

                    if (!cell || cell.total === 0) {
                      return (
                        <div
                          key={`${model1}-${model2}`}
                          className="p-4 border rounded-lg bg-muted/30"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium truncate">{model2}</span>
                            <Badge variant="outline">No data</Badge>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`${model1}-${model2}`}
                        className={`p-4 border-2 rounded-lg transition-all hover:scale-105 ${getWinRateColor(cell.winRate)}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium truncate pr-2">{model2}</span>
                          <Badge variant={
                            cell.winRate >= 60 ? 'default' : 
                            cell.winRate >= 45 && cell.winRate <= 55 ? 'secondary' : 
                            'destructive'
                          }>
                            {cell.winRate.toFixed(1)}%
                          </Badge>
                        </div>
                        <div className="text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="opacity-70">Wins:</span>
                            <span className="font-bold">{cell.model1Wins}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-70">Losses:</span>
                            <span className="font-bold">{cell.model2Wins}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-70">Ties:</span>
                            <span className="font-bold">{cell.ties}</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-current/30">
                            <span className="opacity-70">Total:</span>
                            <span className="font-bold">{cell.total}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
