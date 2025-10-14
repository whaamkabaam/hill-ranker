import { useState, useEffect } from "react";
import { ComparisonView } from "@/components/ComparisonView";
import { RankingModal } from "@/components/RankingModal";
import { PromptProgress } from "@/components/PromptProgress";
import { ReviewRankings } from "@/components/ReviewRankings";
import OnboardingTutorial from "@/components/OnboardingTutorial";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import hvLogo from "@/assets/hv-capital-logo.png";
import { ArrowLeft, Home, BarChart3, History } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<string>("ranking");
  const [showOnboarding, setShowOnboarding] = useState(false);

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
        .eq('is_active', true)
        .eq('is_placeholder', false)
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
        .eq("prompt_id", promptId)
        .eq('is_active', true)
        .eq('is_placeholder', false);

      if (error) throw error;
      setImages(data || []);
    } catch (error) {
      console.error("Error loading images:", error);
      toast.error("Failed to load images");
    }
  };

  const handleComparisonComplete = (winnerImages: ImageWithWins[]) => {
    console.log('📊 ImageRanker handleComparisonComplete called');
    console.log('📊 Received winners:', winnerImages);
    console.log('📊 Current winners state before update:', winners);
    
    if (!winnerImages || winnerImages.length < 3) {
      console.error('❌ Invalid winner images:', winnerImages);
      toast.error(`Not enough winners to rank (got ${winnerImages?.length || 0}, need 3)`);
      return;
    }
    
    console.log('✅ Setting winners and showing ranking modal');
    setWinners(winnerImages);
    setShowRanking(true);
    console.log('✅ State updates queued');
  };

  const handleSkip = () => {
    console.log('⏭️ Skipping prompt, closing modal');
    setShowRanking(false);
    
    // Add delay before clearing winners
    setTimeout(() => {
      console.log('🧹 Clearing winners after skip');
      setWinners([]);
    }, 300);
    
    if (currentPromptIndex < prompts.length - 1) {
      setCurrentPromptIndex(currentPromptIndex + 1);
      setStartTime(Date.now());
      toast.success("Skipped to next prompt");
    } else {
      toast.info("This is the last prompt");
    }
  };

  const handleRankingComplete = async () => {
    console.log('✅ Ranking complete, closing modal');
    setShowRanking(false);
    
    // Check for next uncompleted prompt
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: completed } = await supabase
        .from('prompt_completions')
        .select('prompt_id')
        .eq('user_id', user.id);

      const completedIds = new Set(completed?.map(c => c.prompt_id) || []);
      
      // Check if ALL prompts are now completed
      const allCompleted = prompts.every(p => completedIds.has(p.id));
      
      console.log('📊 Prompt completion status:', {
        currentPrompt: prompts[currentPromptIndex].text,
        completedIds: Array.from(completedIds),
        allCompleted,
        totalPrompts: prompts.length
      });
      
      if (allCompleted) {
        toast.success("🎉 All prompts completed! Amazing work!", {
          duration: 5000
        });
        // Stay on current prompt (don't loop back)
        return;
      }
      
      // Find next uncompleted prompt
      const nextPrompt = prompts.find(p => !completedIds.has(p.id));

      if (nextPrompt) {
        const nextIndex = prompts.findIndex(p => p.id === nextPrompt.id);
        console.log('📊 Moving to next prompt:', { nextIndex, nextPrompt: nextPrompt.text });
        setCurrentPromptIndex(nextIndex);
        setStartTime(Date.now());
        toast.success("Moving to next uncompleted prompt!");
      }
    } catch (error) {
      console.error("Error finding next prompt:", error);
      toast.error("Error loading next prompt");
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
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">No active prompts available</p>
        <p className="text-sm text-muted-foreground">Contact admin to upload voting content</p>
      </div>
    );
  }

  const currentPrompt = prompts[currentPromptIndex];

  return (
    <>
      <OnboardingTutorial onComplete={() => setShowOnboarding(false)} />
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

      <div className="pt-20 p-8">
        <div className="max-w-7xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-8">
              <TabsTrigger value="ranking" className="gap-2">
                <Home className="w-4 h-4" />
                Ranking
              </TabsTrigger>
              <TabsTrigger value="progress" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Progress
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="w-4 h-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ranking">
              <ComparisonView
                key={currentPrompt.id}
                promptId={currentPrompt.id}
                promptText={currentPrompt.text}
                images={images}
                userEmail={user?.email || ''}
                onComplete={handleComparisonComplete}
                onSkip={handleSkip}
              />
            </TabsContent>

            <TabsContent value="progress">
              <PromptProgress userId={user?.id || ''} />
            </TabsContent>

            <TabsContent value="history">
              <ReviewRankings userId={user?.id || ''} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <RankingModal
        open={showRanking}
        winners={winners}
        promptId={currentPrompt.id}
        userEmail={user?.email || ''}
        startTime={startTime}
        onComplete={handleRankingComplete}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            // Modal fully closed - safe to clear winners now
            console.log('🧹 Modal closed, clearing winners after delay');
            setTimeout(() => setWinners([]), 300);
          }
        }}
      />
    </>
  );
};

export default ImageRanker;
