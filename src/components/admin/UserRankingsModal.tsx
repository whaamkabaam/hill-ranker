import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface UserRankingsModalProps {
  userId: string;
  userEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RankingWithDetails {
  id: string;
  promptText: string;
  firstModel: string;
  secondModel: string;
  thirdModel: string;
  ratingFirst: number;
  ratingSecond: number;
  ratingThird: number;
  consistencyScore: number;
  voteCertainty: number;
  avgVoteTime: number;
  transitivityViolations: number;
  qualityFlags: string[];
  createdAt: string;
  completionTime: number;
}

export default function UserRankingsModal({
  userId,
  userEmail,
  open,
  onOpenChange,
}: UserRankingsModalProps) {
  const [rankings, setRankings] = useState<RankingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchUserRankings();
    }
  }, [open, userId]);

  const fetchUserRankings = async () => {
    setLoading(true);
    try {
      const { data: rankingsData, error: rankingsError } = await supabase
        .from('rankings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (rankingsError) throw rankingsError;

      // Fetch related data
      const [promptsRes, imagesRes] = await Promise.all([
        supabase.from('prompts').select('*'),
        supabase.from('images').select('*'),
      ]);

      if (promptsRes.error) throw promptsRes.error;
      if (imagesRes.error) throw imagesRes.error;

      const prompts = promptsRes.data || [];
      const images = imagesRes.data || [];

      // Build detailed rankings
      const detailed: RankingWithDetails[] = rankingsData?.map(ranking => {
        const prompt = prompts.find(p => p.id === ranking.prompt_id);
        const firstImg = images.find(img => img.id === ranking.first_id);
        const secondImg = images.find(img => img.id === ranking.second_id);
        const thirdImg = images.find(img => img.id === ranking.third_id);

        return {
          id: ranking.id,
          promptText: prompt?.text || 'Unknown prompt',
          firstModel: firstImg?.model_name || 'Unknown',
          secondModel: secondImg?.model_name || 'Unknown',
          thirdModel: thirdImg?.model_name || 'Unknown',
          ratingFirst: ranking.rating_first,
          ratingSecond: ranking.rating_second,
          ratingThird: ranking.rating_third,
          consistencyScore: ranking.consistency_score || 0,
          voteCertainty: ranking.vote_certainty || 0,
          avgVoteTime: ranking.average_vote_time_seconds || 0,
          transitivityViolations: ranking.transitivity_violations || 0,
          qualityFlags: ranking.quality_flags || [],
          createdAt: ranking.created_at,
          completionTime: ranking.completion_time_seconds || 0,
        };
      }) || [];

      setRankings(detailed);
    } catch (error) {
      console.error('Error fetching user rankings:', error);
      toast.error('Failed to load user rankings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Rankings for {userEmail}</DialogTitle>
          <DialogDescription>
            All completed rankings and quality metrics for this user
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : rankings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No rankings found for this user
            </p>
          ) : (
            <div className="space-y-6">
              {rankings.map((ranking) => (
                <div key={ranking.id} className="border rounded-lg p-4 space-y-3">
                  {/* Prompt */}
                  <div>
                    <p className="text-sm font-medium mb-1">Prompt:</p>
                    <p className="text-sm text-muted-foreground italic">{ranking.promptText}</p>
                  </div>

                  <Separator />

                  {/* Rankings */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Badge variant="default" className="mb-2">1st Place</Badge>
                      <p className="text-sm font-medium">{ranking.firstModel}</p>
                      <p className="text-xs text-muted-foreground">
                        Rating: {ranking.ratingFirst.toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <Badge variant="secondary" className="mb-2">2nd Place</Badge>
                      <p className="text-sm font-medium">{ranking.secondModel}</p>
                      <p className="text-xs text-muted-foreground">
                        Rating: {ranking.ratingSecond.toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <Badge variant="outline" className="mb-2">3rd Place</Badge>
                      <p className="text-sm font-medium">{ranking.thirdModel}</p>
                      <p className="text-xs text-muted-foreground">
                        Rating: {ranking.ratingThird.toFixed(1)}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Quality Metrics */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Consistency:</span>{' '}
                      <Badge variant={ranking.consistencyScore >= 70 ? 'default' : 'destructive'} className="ml-1">
                        {ranking.consistencyScore.toFixed(1)}%
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Certainty:</span>{' '}
                      <Badge variant="secondary" className="ml-1">
                        {ranking.voteCertainty.toFixed(1)}%
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Avg Vote Time:</span>{' '}
                      <span className="font-medium">{ranking.avgVoteTime.toFixed(1)}s</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Violations:</span>{' '}
                      <Badge variant={ranking.transitivityViolations === 0 ? 'default' : 'destructive'} className="ml-1">
                        {ranking.transitivityViolations}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Completion Time:</span>{' '}
                      <span className="font-medium">{Math.floor(ranking.completionTime / 60)}m {ranking.completionTime % 60}s</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Submitted:</span>{' '}
                      <span className="font-medium">
                        {new Date(ranking.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Quality Flags */}
                  {ranking.qualityFlags.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Quality Flags:</p>
                        <div className="flex flex-wrap gap-1">
                          {ranking.qualityFlags.map((flag) => (
                            <Badge key={flag} variant="destructive" className="text-xs">
                              {flag.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
