import { useState, useEffect } from "react";
import { ComparisonView } from "@/components/ComparisonView";
import { RankingModal } from "@/components/RankingModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import hvLogo from "@/assets/hv-capital-logo.png";
import { ArrowLeft, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

interface ImageWithWins extends Image {
  wins: number;
}

const ImageRanker = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRanking, setShowRanking] = useState(false);
  const [winners, setWinners] = useState<ImageWithWins[]>([]);
  const [startTime, setStartTime] = useState(Date.now());

  useEffect(() => {
    loadPrompts();
  }, []);

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

  const handleComparisonComplete = (winnerImages: ImageWithWins[]) => {
    console.log('📊 ImageRanker received winners:', winnerImages);
    
    if (!winnerImages || winnerImages.length < 3) {
      console.error('❌ Invalid winner images:', winnerImages);
      toast.error(`Not enough winners to rank (got ${winnerImages?.length || 0}, need 3)`);
      return;
    }
    
    console.log('✅ Setting winners and showing ranking modal');
    setWinners(winnerImages);
    setShowRanking(true);
  };

  const handleSkip = () => {
    setShowRanking(false);
    setWinners([]);
    
    if (currentPromptIndex < prompts.length - 1) {
      setCurrentPromptIndex(currentPromptIndex + 1);
      setStartTime(Date.now());
      toast.success("Skipped to next prompt");
    } else {
      toast.info("This is the last prompt");
    }
  };

  const handleRankingComplete = async () => {
    setShowRanking(false);
    setWinners([]);
    
    // Check for next uncompleted prompt
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: completed } = await supabase
        .from('prompt_completions')
        .select('prompt_id')
        .eq('user_id', user.id);

      const completedIds = new Set(completed?.map(c => c.prompt_id) || []);
      const nextPrompt = prompts.find(p => !completedIds.has(p.id));

      if (nextPrompt) {
        const nextIndex = prompts.findIndex(p => p.id === nextPrompt.id);
        setCurrentPromptIndex(nextIndex);
        setStartTime(Date.now());
        toast.success("Moving to next uncompleted prompt!");
      } else {
        toast.success("All prompts completed! 🎉");
        setCurrentPromptIndex(0);
        setStartTime(Date.now());
      }
    } catch (error) {
      console.error("Error finding next prompt:", error);
      // Fallback to sequential
      if (currentPromptIndex < prompts.length - 1) {
        setCurrentPromptIndex(currentPromptIndex + 1);
        setStartTime(Date.now());
        toast.success("Moving to next prompt!");
      } else {
        toast.success("All prompts completed! 🎉");
        setCurrentPromptIndex(0);
        setStartTime(Date.now());
      }
    }
  };

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
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <img src={hvLogo} alt="HV Capital" className="h-10 object-contain" />
              <div>
                <h1 className="text-xl font-bold">Image AI Ranker</h1>
                <p className="text-sm text-muted-foreground">
                  Prompt {currentPromptIndex + 1} of {prompts.length}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="glass-hover"
              >
                Sign Out
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="gap-2 h-8"
            >
              <Home className="w-3 h-3" />
              Dashboard
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">Image AI Ranker</span>
          </div>
        </div>
      </div>

      <div className="pt-20">
        <ComparisonView
          key={currentPrompt.id}
          promptId={currentPrompt.id}
          promptText={currentPrompt.text}
          images={images}
          userEmail={user?.email || ''}
          onComplete={handleComparisonComplete}
          onSkip={handleSkip}
        />
      </div>

      <RankingModal
        open={showRanking}
        winners={winners}
        promptId={currentPrompt.id}
        userEmail={user?.email || ''}
        startTime={startTime}
        onComplete={handleRankingComplete}
      />
    </>
  );
};

export default ImageRanker;
