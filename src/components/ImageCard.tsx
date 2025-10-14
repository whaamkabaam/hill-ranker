import { useState } from "react";

interface ImageCardProps {
  imageUrl: string;
  modelName: string;
  side: "left" | "right";
  isKing?: boolean;
  onImageLoad?: () => void;
  blindMode?: boolean;
}

export const ImageCard = ({ imageUrl, modelName, side, isKing, onImageLoad, blindMode = false }: ImageCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleImageLoad = () => {
    console.log(`🖼️ ${side === "left" ? "Left" : "Right"} image loaded`);
    onImageLoad?.();
  };

  return (
    <div
      className="relative flex flex-col gap-4 animate-fade-in"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="glass rounded-2xl overflow-hidden relative group">
        <div className="aspect-square relative overflow-hidden">
          <img
            src={imageUrl}
            alt={`${modelName} generated image`}
            className={`w-full h-full object-cover transition-transform duration-300 ${
              isHovered ? 'scale-110' : 'scale-100'
            }`}
            onLoad={handleImageLoad}
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
    </div>
  );
};
