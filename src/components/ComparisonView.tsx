import { useEffect, useState } from "react";
import { ImageCard } from "./ImageCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Image {
  id: string;
  model_name: string;
  image_url: string;
}

interface ComparisonViewProps {
  promptId: string;
  promptText: string;
  images: Image[];
  userEmail: string;
  onComplete: (winners: Image[]) => void;
}

export const ComparisonView = ({
  promptId,
  promptText,
  images,
  userEmail,
  onComplete,
}: ComparisonViewProps) => {
  const [king, setKing] = useState<Image | null>(null);
  const [challenger, setChallenger] = useState<Image | null>(null);
  const [remainingImages, setRemainingImages] = useState<Image[]>([]);
  const [winners, setWinners] = useState<Image[]>([]);

  useEffect(() => {
    if (images.length > 0) {
      setKing(images[0]);
      setRemainingImages(images.slice(1));
    }
  }, [images]);

  useEffect(() => {
    if (remainingImages.length > 0 && king) {
      setChallenger(remainingImages[0]);
    } else if (king && remainingImages.length === 0 && challenger === null) {
      // Tournament complete
      const finalWinners = [...winners, king];
      onComplete(finalWinners.slice(0, 3));
    }
  }, [remainingImages, king, challenger]);

  useEffect(() => {
    const handleKeyPress = async (e: KeyboardEvent) => {
      if (!king || !challenger) return;

      if (e.key.toLowerCase() === "a") {
        await handleSelection(king);
      } else if (e.key.toLowerCase() === "l") {
        await handleSelection(challenger);
      } else if (e.key.toLowerCase() === "t") {
        await handleTie();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [king, challenger]);

  const handleSelection = async (winner: Image) => {
    if (!king || !challenger) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from("votes").insert({
        prompt_id: promptId,
        user_email: userEmail,
        user_id: user?.id,
        left_image_id: king.id,
        right_image_id: challenger.id,
        winner_id: winner.id,
        is_tie: false,
      });

      if (winner.id === king.id) {
        // King stays
        const newWinners = [...winners];
        if (!newWinners.find(w => w.id === challenger.id)) {
          newWinners.push(challenger);
        }
        setWinners(newWinners);
        setRemainingImages(remainingImages.slice(1));
        setChallenger(null);
      } else {
        // Challenger becomes new king
        const newWinners = [...winners];
        if (!newWinners.find(w => w.id === king.id)) {
          newWinners.push(king);
        }
        setWinners(newWinners);
        setKing(challenger);
        setRemainingImages(remainingImages.slice(1));
        setChallenger(null);
      }
    } catch (error) {
      console.error("Error saving vote:", error);
      toast.error("Failed to save vote");
    }
  };

  const handleTie = async () => {
    if (!king || !challenger) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from("votes").insert({
        prompt_id: promptId,
        user_email: userEmail,
        user_id: user?.id,
        left_image_id: king.id,
        right_image_id: challenger.id,
        winner_id: null,
        is_tie: true,
      });

      const newWinners = [...winners];
      if (!newWinners.find(w => w.id === challenger.id)) {
        newWinners.push(challenger);
      }
      setWinners(newWinners);
      setRemainingImages(remainingImages.slice(1));
      setChallenger(null);
    } catch (error) {
      console.error("Error saving tie:", error);
      toast.error("Failed to save tie");
    }
  };

  if (!king || !challenger) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading comparison...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="glass rounded-xl p-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">Current Prompt</p>
          <h2 className="text-xl font-medium">{promptText}</h2>
        </div>

        {/* Comparison */}
        <div className="flex gap-8 items-start">
          <ImageCard
            imageUrl={king.image_url}
            modelName={king.model_name}
            side="left"
            isKing={true}
          />
          <ImageCard
            imageUrl={challenger.image_url}
            modelName={challenger.model_name}
            side="right"
          />
        </div>

        {/* Controls */}
        <div className="glass rounded-xl p-6">
          <div className="flex justify-center items-center gap-4">
            <Button
              onClick={() => handleSelection(king)}
              variant="outline"
              size="lg"
              className="glass-hover"
            >
              A - Left Wins
            </Button>
            <Button
              onClick={handleTie}
              variant="outline"
              size="lg"
              className="glass-hover"
            >
              T - Tie
            </Button>
            <Button
              onClick={() => handleSelection(challenger)}
              variant="outline"
              size="lg"
              className="glass-hover"
            >
              L - Right Wins
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Remaining: {remainingImages.length} of {images.length - 1}
          </p>
        </div>
      </div>
    </div>
  );
};
