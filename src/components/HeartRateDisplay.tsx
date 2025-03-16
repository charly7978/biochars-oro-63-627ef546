
import React, { memo, useEffect, useRef, useState } from 'react';
import { optimizeElement } from '../utils/displayOptimizer';
import { AlertCircle, Heart } from 'lucide-react';

interface HeartRateDisplayProps {
  bpm: number;
  confidence: number;
}

const HeartRateDisplay = memo(({ bpm, confidence }: HeartRateDisplayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isReliable = confidence > 0.5;
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Apply optimizations after component mounts
  useEffect(() => {
    if (containerRef.current) {
      optimizeElement(containerRef.current);
    }
  }, []);
  
  // Animate heart when BPM updates and is reliable
  useEffect(() => {
    if (bpm > 0 && isReliable) {
      setIsAnimating(true);
      
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      
      animationTimeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
      }, 600);
    }
    
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [bpm, isReliable]);
  
  const getValueClass = () => {
    if (!isReliable) return "text-gray-500";
    if (bpm > 100) return "medical-warning-text";
    if (bpm < 60) return "medical-warning-text";
    return "medical-normal-text";
  };

  const getHeartColor = () => {
    if (!isReliable) return "text-gray-400/60";
    if (bpm > 100) return "text-orange-500";
    if (bpm < 60) return "text-blue-500";
    return "text-red-500";
  };

  const getReliabilityIndicator = () => {
    if (confidence > 0.8) return "high";
    if (confidence > 0.5) return "medium";
    return "low";
  };

  return (
    <div 
      ref={containerRef}
      className="glass-card-dark p-3 text-center animation-hardware-accelerated rounded-lg"
    >
      <div className="flex items-center justify-center gap-1 mb-1">
        <h3 className="text-gray-400/90 text-sm typography-clinical">Heart Rate</h3>
        
        {getReliabilityIndicator() === "low" && (
          <div className="relative" title="Signal quality is low">
            <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
          </div>
        )}
      </div>
      
      <div className="flex items-baseline justify-center gap-1">
        <Heart 
          className={`h-4 w-4 mr-0.5 ${getHeartColor()} animation-smooth will-change-transform ${
            isAnimating ? 'scale-150 opacity-80' : 'scale-100 opacity-100'
          }`}
          fill={isReliable ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
        <span className={`text-2xl font-bold typography-medical-data ${getValueClass()}`}>
          {bpm > 0 ? bpm : '--'}
        </span>
        <span className="text-gray-400/90 text-xs unit-text">BPM</span>
      </div>
      
      {/* Signal amplification indicator */}
      {confidence > 0 && (
        <div className="mt-1.5 w-full bg-gray-700/30 rounded-full h-0.5 overflow-hidden">
          <div 
            className={`h-full rounded-full animation-smooth ${
              confidence > 0.8 ? 'bg-green-500' : 
              confidence > 0.5 ? 'bg-yellow-500' : 
              'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, confidence * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
});

HeartRateDisplay.displayName = 'HeartRateDisplay';

export default HeartRateDisplay;
