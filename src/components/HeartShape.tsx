
import React from 'react';
import { cn } from "@/lib/utils";

interface HeartShapeProps {
  isBeating: boolean;
  className?: string;
  reducedMotion?: boolean;
}

const HeartShape = ({ isBeating, className, reducedMotion = false }: HeartShapeProps) => {
  // Apply animation with reduced motion preference check
  const animationClass = isBeating && !reducedMotion ? "animate-efficient-beat" : "";
  
  // If reduced motion is preferred but we still want to indicate activity
  const staticScaleClass = isBeating && reducedMotion ? "scale-105" : "";
  
  return (
    <div
      className={cn(
        "relative w-32 h-32 transform hardware-accelerated will-change-transform",
        animationClass,
        staticScaleClass,
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
