import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Circle } from "lucide-react";
import ProgressGamification from "./ProgressGamification";

interface Prompt {
  id: string;
  text: string;
  order_index: number;
}

interface PromptProgressProps {
  userId: string;
}

export const PromptProgress = ({ userId }: PromptProgressProps) => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, [userId]);

  const loadProgress = async () => {
    try {
      // Load all prompts
      const { data: promptsData } = await supabase
        .from("prompts")
        .select("*")
        .order("order_index");

      // Load completed prompts
      const { data: completedData } = await supabase
        .from("prompt_completions")
        .select("prompt_id")
        .eq("user_id", userId);

      setPrompts(promptsData || []);
      setCompletedIds(new Set(completedData?.map((c) => c.prompt_id) || []));
    } catch (error) {
      console.error("Error loading progress:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground text-center">Loading progress...</p>
      </Card>
    );
  }

  const completedCount = completedIds.size;
  const totalCount = prompts.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <Card className="p-6 space-y-6 glass-card">
      <div>
        <h3 className="text-lg font-semibold mb-2">Overall Progress</h3>
        <p className="text-sm text-muted-foreground">
          {completedCount} of {totalCount} prompts completed
        </p>
      </div>

      <ProgressGamification
        completed={completedCount}
        total={totalCount}
        showConfetti={completedCount === totalCount}
      />

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {prompts.map((prompt, idx) => {
          const isCompleted = completedIds.has(prompt.id);
          return (
            <div
              key={prompt.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              {isCompleted ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Prompt {idx + 1}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {prompt.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
