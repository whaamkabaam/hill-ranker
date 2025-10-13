import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Image {
  id: string;
  model_name: string;
  image_url: string;
}

interface RankingModalProps {
  open: boolean;
  winners: Image[];
  promptId: string;
  userEmail: string;
  onComplete: () => void;
}

export const RankingModal = ({
  open,
  winners,
  promptId,
  userEmail,
  onComplete,
}: RankingModalProps) => {
  const [rankings, setRankings] = useState<Image[]>(winners.slice(0, 3));
  const [ratings, setRatings] = useState<Record<string, number>>({
    [winners[0]?.id]: 5,
    [winners[1]?.id]: 5,
    [winners[2]?.id]: 5,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rankings.length !== 3) {
      toast.error("Please rank all 3 images");
      return;
    }

    setSubmitting(true);
    try {
      await supabase.from("rankings").insert({
        prompt_id: promptId,
        user_email: userEmail,
        first_id: rankings[0].id,
        second_id: rankings[1].id,
        third_id: rankings[2].id,
        rating_first: ratings[rankings[0].id],
        rating_second: ratings[rankings[1].id],
        rating_third: ratings[rankings[2].id],
      });

      toast.success("Rankings saved successfully!");
      onComplete();
    } catch (error) {
      console.error("Error saving rankings:", error);
      toast.error("Failed to save rankings");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-4xl glass">
        <DialogHeader>
          <DialogTitle className="text-2xl">Rank Top 3 & Rate Realism</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-6 mt-6">
          {rankings.map((image, index) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="space-y-4"
            >
              <div className="relative">
                <div className="glass rounded-xl overflow-hidden">
                  <img
                    src={image.image_url}
                    alt={image.model_name}
                    className="w-full aspect-square object-cover"
                  />
                </div>
                <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold">
                  {index + 1}
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-center">{image.model_name}</p>
                
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground block text-center">
                    Realism Rating: {ratings[image.id].toFixed(1)}
                  </label>
                  <Slider
                    min={1}
                    max={10}
                    step={0.1}
                    value={[ratings[image.id]]}
                    onValueChange={([value]) =>
                      setRatings({ ...ratings, [image.id]: value })
                    }
                    className="py-4"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1.0</span>
                    <span>10.0</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full mt-6"
          size="lg"
        >
          {submitting ? "Saving..." : "Submit Rankings"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
