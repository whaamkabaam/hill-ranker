import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, Award } from "lucide-react";
import { format } from "date-fns";

interface Ranking {
  id: string;
  prompt_id: string;
  created_at: string;
  first_id: string;
  second_id: string;
  third_id: string;
  rating_first: number;
  rating_second: number;
  rating_third: number;
  consistency_score: number | null;
  vote_certainty: number | null;
  transitivity_violations: number | null;
  completion_time_seconds: number | null;
}

interface Image {
  id: string;
  model_name: string;
  image_url: string;
}

interface Prompt {
  id: string;
  text: string;
}

interface ReviewRankingsProps {
  userId: string;
}

export const ReviewRankings = ({ userId }: ReviewRankingsProps) => {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [prompts, setPrompts] = useState<Map<string, Prompt>>(new Map());
  const [images, setImages] = useState<Map<string, Image>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRankings();
  }, [userId]);

  const loadRankings = async () => {
    try {
      // Load user's rankings
      const { data: rankingsData } = await supabase
        .from("rankings")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!rankingsData) return;

      // Load all prompts
      const { data: promptsData } = await supabase
        .from("prompts")
        .select("*");

      const promptsMap = new Map(
        promptsData?.map((p) => [p.id, p]) || []
      );

      // Load all images for these rankings
      const imageIds = new Set<string>();
      rankingsData.forEach((r) => {
        imageIds.add(r.first_id);
        imageIds.add(r.second_id);
        imageIds.add(r.third_id);
      });

      const { data: imagesData } = await supabase
        .from("images")
        .select("*")
        .in("id", Array.from(imageIds));

      const imagesMap = new Map(
        imagesData?.map((i) => [i.id, i]) || []
      );

      setRankings(rankingsData);
      setPrompts(promptsMap);
      setImages(imagesMap);
    } catch (error) {
      console.error("Error loading rankings:", error);
    } finally {
      setLoading(false);
    }
  };

  const getQualityBadgeColor = (score: number | null) => {
    if (!score) return "secondary";
    if (score >= 90) return "default";
    if (score >= 70) return "secondary";
    return "destructive";
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground text-center">Loading rankings...</p>
      </Card>
    );
  }

  if (rankings.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground text-center">
          No rankings yet. Complete some prompts to see your history!
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Your Ranking History</h3>
      
      {rankings.map((ranking) => {
        const prompt = prompts.get(ranking.prompt_id);
        const first = images.get(ranking.first_id);
        const second = images.get(ranking.second_id);
        const third = images.get(ranking.third_id);

        return (
          <Card key={ranking.id} className="p-6 space-y-4">
            {/* Prompt Info */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">
                  {prompt?.text || "Unknown prompt"}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(ranking.created_at), "MMM d, yyyy 'at' h:mm a")}
                  {ranking.completion_time_seconds && (
                    <span className="ml-2">
                      • {Math.round(ranking.completion_time_seconds / 60)}m {ranking.completion_time_seconds % 60}s
                    </span>
                  )}
                </div>
              </div>
              
              {/* Quality Metrics */}
              <div className="flex flex-wrap gap-2">
                {ranking.consistency_score !== null && (
                  <Badge variant={getQualityBadgeColor(ranking.consistency_score)}>
                    {ranking.consistency_score.toFixed(0)}% Consistent
                  </Badge>
                )}
                {ranking.vote_certainty !== null && (
                  <Badge variant="outline">
                    {ranking.vote_certainty.toFixed(0)}% Certain
                  </Badge>
                )}
                {ranking.transitivity_violations !== null && ranking.transitivity_violations > 0 && (
                  <Badge variant="destructive">
                    {ranking.transitivity_violations} violations
                  </Badge>
                )}
              </div>
            </div>

            {/* Rankings Display */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { image: first, rating: ranking.rating_first, place: 1 },
                { image: second, rating: ranking.rating_second, place: 2 },
                { image: third, rating: ranking.rating_third, place: 3 },
              ].map(({ image, rating, place }) => (
                <div key={place} className="space-y-2">
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-secondary">
                    {image && (
                      <img
                        src={image.image_url}
                        alt={image.model_name}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-background/80 backdrop-blur-sm">
                        {place === 1 && <Award className="w-3 h-3 mr-1 text-yellow-500" />}
                        {place === 2 && <Award className="w-3 h-3 mr-1 text-gray-400" />}
                        {place === 3 && <Award className="w-3 h-3 mr-1 text-orange-600" />}
                        #{place}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{image?.model_name || "Unknown"}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <TrendingUp className="w-3 h-3" />
                      Realism: {rating}/10
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
};
