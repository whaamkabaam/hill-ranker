import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useEffect } from "react";

interface ImagePreviewModalProps {
  imageUrl: string;
  modelName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allImages?: { url: string; name: string }[];
  currentIndex?: number;
  onNavigate?: (direction: 'prev' | 'next') => void;
}

export const ImagePreviewModal = ({
  imageUrl,
  modelName,
  open,
  onOpenChange,
  allImages,
  currentIndex,
  onNavigate,
}: ImagePreviewModalProps) => {
  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none" 
        style={{ zIndex: 9999 }}
      >
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
          onClick={() => onOpenChange(false)}
        >
          <X className="w-6 h-6" />
        </Button>

        {/* Image */}
        <div className="flex items-center justify-center p-8 min-h-[80vh]">
          <div className="relative">
            <img
              src={imageUrl}
              alt={modelName}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            {/* Model name overlay */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-lg backdrop-blur-sm">
              <p className="text-lg font-semibold">{modelName}</p>
              {allImages && currentIndex !== undefined && (
                <p className="text-sm text-white/70 text-center">
                  {currentIndex + 1} of {allImages.length}
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
