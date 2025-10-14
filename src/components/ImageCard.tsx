import { motion } from "framer-motion";
import { useState } from "react";

interface ImageCardProps {
  imageUrl: string;
  modelName: string;
  side: "left" | "right";
  isKing?: boolean;
  onImageLoad?: () => void;
  blindMode?: boolean; // Hide model name during comparison
  skipAnimation?: boolean; // Skip initial animation
}

export const ImageCard = ({ imageUrl, modelName, side, isKing, onImageLoad, blindMode = false, skipAnimation = false }: ImageCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleImageLoad = () => {
    console.log(`🖼️ ${side === "left" ? "Left" : "Right"} image loaded`);
    onImageLoad?.();
  };

  return (
    <motion.div
      initial={skipAnimation ? false : { opacity: 0, x: side === "left" ? -50 : 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: side === "left" ? -100 : 100 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col gap-4"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="glass rounded-2xl overflow-hidden relative group">
        <div className="aspect-square relative overflow-hidden">
          <motion.img
            src={imageUrl}
            alt={`${modelName} generated image`}
            className="w-full h-full object-cover"
            onLoad={handleImageLoad}
            animate={{
              scale: isHovered ? 1.1 : 1,
              opacity: 1,
            }}
            transition={{ duration: 0.3 }}
          />
          {isKing && (
            <div className="absolute top-4 left-4 bg-yellow-500/90 text-white px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 shadow-lg">
              <span className="text-base">👑</span>
              Champion
            </div>
          )}
        </div>
      </div>
      
      <div className="text-center">
        {blindMode ? (
          <>
            <p className="text-lg font-medium">Image {side === "left" ? "A" : "B"}</p>
            <p className="text-sm text-muted-foreground">
              Model name hidden (blind test)
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-medium">{modelName}</p>
            <p className="text-sm text-muted-foreground">
              Press {side === "left" ? "←" : "→"} to select
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
};
