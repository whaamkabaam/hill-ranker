import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Trophy, Star, TrendingUp, Users } from 'lucide-react';
import { parseModelNameFromFile } from '@/lib/modelNameParser';

interface ModelStats {
  modelName: string;
  firstPlaceCount: number;
  secondPlaceCount: number;
  thirdPlaceCount: number;
  avgRating: number;
  avgPosition: number;
  totalAppearances: number;
}

interface PromptStats {
  promptId: string;
  promptText: string;
  models: {
    modelName: string;
    firstPlaceCount: number;
    avgRating: number;
  }[];
}

export function GlobalLeaderboard() {
  const [modelStats, setModelStats] = useState<ModelStats[]>([]);
  const [promptStats, setPromptStats] = useState<PromptStats[]>([]);
  const [totalRankings, setTotalRankings] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboardData();
  }, []);

  const loadLeaderboardData = async () => {
    try {
      setLoading(true);

      // Fetch all rankings with image data
      const { data: rankings, error: rankingsError } = await supabase
        .from('rankings')
        .select(`
          id,
          prompt_id,
          first_id,
          second_id,
          third_id,
          rating_first,
          rating_second,
          rating_third,
          user_id
        `);

      if (rankingsError) throw rankingsError;

      // Fetch all images to map IDs to model names
      const { data: images, error: imagesError } = await supabase
        .from('images')
        .select('id, model_name');

      if (imagesError) throw imagesError;

      // Fetch all prompts
      const { data: prompts, error: promptsError } = await supabase
        .from('prompts')
        .select('id, text');

      if (promptsError) throw promptsError;

      // Create image ID to model name map
      const imageMap = new Map(images?.map(img => [img.id, parseModelNameFromFile(img.model_name)]) || []);
      const promptMap = new Map(prompts?.map(p => [p.id, p.text]) || []);

      // Calculate total users
      const uniqueUsers = new Set(rankings?.map(r => r.user_id) || []);
      setTotalUsers(uniqueUsers.size);
      setTotalRankings(rankings?.length || 0);

      // Aggregate global stats by model
      const modelStatsMap = new Map<string, ModelStats>();

      rankings?.forEach(ranking => {
        const firstModel = imageMap.get(ranking.first_id);
        const secondModel = imageMap.get(ranking.second_id);
        const thirdModel = imageMap.get(ranking.third_id);

        // Process first place
        if (firstModel) {
          const stats = modelStatsMap.get(firstModel) || {
            modelName: firstModel,
            firstPlaceCount: 0,
            secondPlaceCount: 0,
            thirdPlaceCount: 0,
            avgRating: 0,
            avgPosition: 0,
            totalAppearances: 0,
          };
          stats.firstPlaceCount++;
          stats.totalAppearances++;
          modelStatsMap.set(firstModel, stats);
        }

        // Process second place
        if (secondModel) {
          const stats = modelStatsMap.get(secondModel) || {
            modelName: secondModel,
            firstPlaceCount: 0,
            secondPlaceCount: 0,
            thirdPlaceCount: 0,
            avgRating: 0,
            avgPosition: 0,
            totalAppearances: 0,
          };
          stats.secondPlaceCount++;
          stats.totalAppearances++;
          modelStatsMap.set(secondModel, stats);
        }

        // Process third place
        if (thirdModel) {
          const stats = modelStatsMap.get(thirdModel) || {
            modelName: thirdModel,
            firstPlaceCount: 0,
            secondPlaceCount: 0,
            thirdPlaceCount: 0,
            avgRating: 0,
            avgPosition: 0,
            totalAppearances: 0,
          };
          stats.thirdPlaceCount++;
          stats.totalAppearances++;
          modelStatsMap.set(thirdModel, stats);
        }
      });

      // Calculate average position and rating
      const modelStatsArray = Array.from(modelStatsMap.values()).map(stats => {
        const totalPositionSum = 
          stats.firstPlaceCount * 1 + 
          stats.secondPlaceCount * 2 + 
          stats.thirdPlaceCount * 3;
        stats.avgPosition = totalPositionSum / stats.totalAppearances;
        
        // Calculate win rate as a score (higher is better)
        stats.avgRating = (
          (stats.firstPlaceCount * 3 + stats.secondPlaceCount * 2 + stats.thirdPlaceCount * 1) / 
          stats.totalAppearances
        );
        
        return stats;
      });

      // Sort by first place count, then by average rating
      modelStatsArray.sort((a, b) => {
        if (b.firstPlaceCount !== a.firstPlaceCount) {
          return b.firstPlaceCount - a.firstPlaceCount;
        }
        return b.avgRating - a.avgRating;
      });

      setModelStats(modelStatsArray);

      // Aggregate per-prompt stats
      const promptStatsMap = new Map<string, PromptStats>();

      rankings?.forEach(ranking => {
        const promptText = promptMap.get(ranking.prompt_id) || 'Unknown Prompt';
        const firstModel = imageMap.get(ranking.first_id);

        if (!promptStatsMap.has(ranking.prompt_id)) {
          promptStatsMap.set(ranking.prompt_id, {
            promptId: ranking.prompt_id,
            promptText,
            models: [],
          });
        }

        const promptStat = promptStatsMap.get(ranking.prompt_id)!;
        
        if (firstModel) {
          const modelStat = promptStat.models.find(m => m.modelName === firstModel);
          if (modelStat) {
            modelStat.firstPlaceCount++;
            modelStat.avgRating = (modelStat.avgRating + (ranking.rating_first || 0)) / 2;
          } else {
            promptStat.models.push({
              modelName: firstModel,
              firstPlaceCount: 1,
              avgRating: ranking.rating_first || 0,
            });
          }
        }
      });

      // Sort models within each prompt by first place count
      const promptStatsArray = Array.from(promptStatsMap.values()).map(stat => {
        stat.models.sort((a, b) => b.firstPlaceCount - a.firstPlaceCount);
        return stat;
      });

      setPromptStats(promptStatsArray);

    } catch (error) {
      console.error('Error loading leaderboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Rankings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRankings}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Models Ranked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{modelStats.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Global Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Global AI Model Leaderboard
          </CardTitle>
          <CardDescription>
            Aggregated rankings from all users across all prompts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Rank</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-center">🥇 1st</TableHead>
                <TableHead className="text-center">🥈 2nd</TableHead>
                <TableHead className="text-center">🥉 3rd</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-center">Avg Position</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelStats.map((model, index) => (
                <TableRow key={model.modelName}>
                  <TableCell className="font-bold">
                    {index + 1}
                    {index === 0 && <Trophy className="inline h-4 w-4 ml-1 text-yellow-500" />}
                  </TableCell>
                  <TableCell className="font-medium">{model.modelName}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="default">{model.firstPlaceCount}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{model.secondPlaceCount}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{model.thirdPlaceCount}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                      <span className="font-medium">{model.avgRating.toFixed(2)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {model.avgPosition.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Per-Prompt Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Per-Prompt Breakdown</CardTitle>
          <CardDescription>
            See which models ranked highest for each specific prompt
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {promptStats.map((prompt) => (
              <AccordionItem key={prompt.promptId} value={prompt.promptId}>
                <AccordionTrigger>
                  <div className="text-left">
                    <div className="font-medium">{prompt.promptText}</div>
                    <div className="text-sm text-muted-foreground">
                      Top: {prompt.models[0]?.modelName || 'N/A'}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead className="text-center">1st Place Votes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prompt.models.slice(0, 5).map((model, index) => (
                        <TableRow key={model.modelName}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>{model.modelName}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={index === 0 ? "default" : "secondary"}>
                              {model.firstPlaceCount}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
