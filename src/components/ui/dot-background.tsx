import { cn } from "@/lib/utils";
import React from "react";

export const DotBackground = ({ className }: { className?: string }) => {
  return (
    <div className={cn("fixed inset-0 h-screen w-screen", className)}>
      <div
        className={cn(
          "absolute inset-0",
          "[background-size:24px_24px]",
          "[background-image:radial-gradient(hsl(356_85%_57%_/_0.3)_1.5px,transparent_1.5px)]",
          "dark:[background-image:radial-gradient(hsl(356_85%_57%_/_0.4)_1.5px,transparent_1.5px)]",
        )}
      />
      {/* Radial gradient for the container to give a faded look */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
    </div>
  );
};
