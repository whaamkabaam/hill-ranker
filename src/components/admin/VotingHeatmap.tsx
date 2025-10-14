import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface HeatmapCell {
  model1: string;
  model2: string;
  model1Wins: number;
  model2Wins: number;
  ties: number;
  total: number;
  winRate: number; // % for model1
}

export default function VotingHeatmap() {
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

      // Get unique model names
      const uniqueModels = Array.from(new Set(images.map(img => img.model_name))).sort();
      setModels(uniqueModels);

      // Build heatmap data
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

            // Check if this vote involves both models
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
      toast.error('Failed to load voting heatmap');
    } finally {
      setLoading(false);
    }
  };

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 60) return 'bg-success/20 text-success';
    if (winRate >= 45 && winRate <= 55) return 'bg-warning/20 text-warning';
    if (winRate <= 40) return 'bg-destructive/20 text-destructive';
    return 'bg-muted text-muted-foreground';
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
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>Pairwise Comparison Matrix</CardTitle>
        <CardDescription>
          Win rates for direct model-to-model comparisons (rows vs columns)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {models.map((model1, i) => (
            <div key={model1}>
              <h3 className="font-semibold mb-2">{model1}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {models.slice(i + 1).map((model2) => {
                  const cell = heatmapData.find(
                    c => c.model1 === model1 && c.model2 === model2
                  );

                  if (!cell) return null;

                  return (
                    <div
                      key={`${model1}-${model2}`}
                      className={`p-4 border rounded-lg ${getWinRateColor(cell.winRate)}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">vs {model2}</span>
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
                          <span className="text-muted-foreground">Wins:</span>
                          <span className="font-medium">{cell.model1Wins}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Losses:</span>
                          <span className="font-medium">{cell.model2Wins}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ties:</span>
                          <span className="font-medium">{cell.ties}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t">
                          <span className="text-muted-foreground">Total:</span>
                          <span className="font-medium">{cell.total}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {heatmapData.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No comparison data available yet. Start voting to see the heatmap!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
