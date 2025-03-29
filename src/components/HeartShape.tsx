
import React from 'react';
import { cn } from "@/lib/utils";

interface HeartShapeProps {
  isBeating: boolean;
  className?: string;
  reducedMotion?: boolean;
}

const HeartShape = ({ isBeating, className, reducedMotion = false }: HeartShapeProps) => {
  // Use our CSS-based animation with inherent reduced motion support
  const animationClass = isBeating ? "animate-efficient-beat" : "";
  
  return (
    <div
      className={cn(
        "relative w-32 h-32 transform animation-hardware-accelerated will-change-transform",
        animationClass,
        className
      )}
    >
      <div
        className="absolute w-20 h-32 bg-[var(--medical-danger-direct)] dark:bg-[var(--medical-danger-dark)] rounded-t-full -rotate-45 origin-bottom-right"
        style={{ left: "41px" }}
      />
      <div
        className="absolute w-20 h-32 bg-[var(--medical-danger-direct)] dark:bg-[var(--medical-danger-dark)] rounded-t-full rotate-45 origin-bottom-left"
        style={{ left: "0" }}
      />
    </div>
  );
};

export default HeartShape;
