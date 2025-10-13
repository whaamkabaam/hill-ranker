import { useState, useEffect } from "react";
import { AuthGate } from "@/components/AuthGate";
import { ComparisonView } from "@/components/ComparisonView";
import { RankingModal } from "@/components/RankingModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import hvLogo from "@/assets/hv-capital-logo.png";

interface Prompt {
  id: string;
  text: string;
  order_index: number;
}

interface Image {
  id: string;
  model_name: string;
  image_url: string;
  prompt_id: string;
}

const Index = () => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRanking, setShowRanking] = useState(false);
  const [winners, setWinners] = useState<Image[]>([]);

  useEffect(() => {
    if (userEmail) {
      loadPrompts();
    }
  }, [userEmail]);

  useEffect(() => {
    if (prompts.length > 0) {
      loadImages(prompts[currentPromptIndex].id);
    }
  }, [currentPromptIndex, prompts]);

  const loadPrompts = async () => {
    try {
      const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .order("order_index");

      if (error) throw error;
      setPrompts(data || []);
    } catch (error) {
      console.error("Error loading prompts:", error);
      toast.error("Failed to load prompts");
    } finally {
      setLoading(false);
    }
  };

  const loadImages = async (promptId: string) => {
    try {
      const { data, error } = await supabase
        .from("images")
        .select("*")
        .eq("prompt_id", promptId);

      if (error) throw error;
      setImages(data || []);
    } catch (error) {
      console.error("Error loading images:", error);
      toast.error("Failed to load images");
    }
  };

  const handleComparisonComplete = (winnerImages: Image[]) => {
    setWinners(winnerImages);
    setShowRanking(true);
  };

  const handleRankingComplete = () => {
    setShowRanking(false);
    setWinners([]);
    
    if (currentPromptIndex < prompts.length - 1) {
      setCurrentPromptIndex(currentPromptIndex + 1);
      toast.success("Moving to next prompt!");
    } else {
      toast.success("All prompts completed! 🎉");
      setCurrentPromptIndex(0);
    }
  };

  if (!userEmail) {
    return <AuthGate onAuthenticated={setUserEmail} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">No prompts available</p>
      </div>
    );
  }

  const currentPrompt = prompts[currentPromptIndex];

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 glass border-b">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={hvLogo} alt="HV Capital" className="h-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold">HVC.tools</h1>
              <p className="text-sm text-muted-foreground">
                Prompt {currentPromptIndex + 1} of {prompts.length}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{userEmail}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUserEmail(null)}
              className="glass-hover"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="pt-20">
        <ComparisonView
          key={currentPrompt.id}
          promptId={currentPrompt.id}
          promptText={currentPrompt.text}
          images={images}
          userEmail={userEmail}
          onComplete={handleComparisonComplete}
        />
      </div>

      <RankingModal
        open={showRanking}
        winners={winners}
        promptId={currentPrompt.id}
        userEmail={userEmail}
        onComplete={handleRankingComplete}
      />
    </>
  );
};

export default Index;
