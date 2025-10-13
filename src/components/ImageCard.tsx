import { motion } from "framer-motion";
import { useState } from "react";

interface ImageCardProps {
  imageUrl: string;
  modelName: string;
  side: "left" | "right";
  isKing?: boolean;
}

export const ImageCard = ({ imageUrl, modelName, side, isKing }: ImageCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -50 : 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: side === "left" ? -100 : 100 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex-1 flex flex-col gap-4"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="glass rounded-2xl overflow-hidden relative group">
        <div className="aspect-square relative overflow-hidden">
          <motion.img
            src={imageUrl}
            alt={`${modelName} generated image`}
            className="w-full h-full object-cover"
            animate={{
              scale: isHovered ? 1.1 : 1,
            }}
            transition={{ duration: 0.3 }}
          />
          {isKing && (
            <div className="absolute top-4 left-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
              👑 King
            </div>
          )}
        </div>
      </div>
      
      <div className="text-center">
        <p className="text-lg font-medium">{modelName}</p>
        <p className="text-sm text-muted-foreground">
          Press {side === "left" ? "A" : "L"} to select
        </p>
      </div>
    </motion.div>
  );
};
