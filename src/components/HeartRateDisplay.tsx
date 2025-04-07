
import React, { memo, useEffect, useRef, useState } from 'react';
import { optimizeElement } from '../utils/displayOptimizer';
import { AlertCircle, Heart, ShieldAlert } from 'lucide-react';

interface HeartRateDisplayProps {
  bpm: number;
  confidence: number;
}

const HeartRateDisplay = memo(({ bpm, confidence }: HeartRateDisplayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isReliable = confidence > 0.5;
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [displayState, setDisplayState] = useState<'loading' | 'error' | 'normal'>('loading');
  const [errorCount, setErrorCount] = useState(0);
  
  // Apply optimizations after component mounts
  useEffect(() => {
    if (containerRef.current) {
      optimizeElement(containerRef.current);
    }
    
    // Set initial state based on incoming data
    if (bpm <= 0 || confidence <= 0) {
      setDisplayState('loading');
    } else if (confidence < 0.3) {
      setDisplayState('error');
    } else {
      setDisplayState('normal');
    }
    
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);
  
  // Detect errors and update display state
  useEffect(() => {
    // Track rendering errors
    try {
      // Validate incoming data
      if (typeof bpm !== 'number' || isNaN(bpm)) {
        console.error('HeartRateDisplay: Invalid BPM value:', bpm);
        setDisplayState('error');
        setErrorCount(prev => prev + 1);
        return;
      }
      
      if (typeof confidence !== 'number' || isNaN(confidence)) {
        console.error('HeartRateDisplay: Invalid confidence value:', confidence);
        setDisplayState('error');
        setErrorCount(prev => prev + 1);
        return;
      }
      
      // Update state based on valid data
      if (bpm > 0 && confidence > 0.3) {
        setDisplayState('normal');
        setErrorCount(0);
      } else if (bpm <= 0 || confidence <= 0) {
        setDisplayState(prev => prev === 'error' ? 'error' : 'loading');
      } else if (confidence < 0.3) {
        setDisplayState('error');
      }
    } catch (error) {
      console.error('HeartRateDisplay: Error in data validation effect:', error);
      setDisplayState('error');
      setErrorCount(prev => prev + 1);
    }
  }, [bpm, confidence]);
  
  // Animate heart when BPM updates and is reliable
  useEffect(() => {
    try {
      if (bpm > 0 && isReliable) {
        setIsAnimating(true);
        
        if (animationTimeoutRef.current) {
          clearTimeout(animationTimeoutRef.current);
        }
        
        animationTimeoutRef.current = setTimeout(() => {
          setIsAnimating(false);
        }, 600);
      }
    } catch (error) {
      console.error('HeartRateDisplay: Error in animation effect:', error);
    }
    
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [bpm, isReliable]);
  
  const getValueClass = () => {
    if (displayState === 'error' || !isReliable) return "text-gray-500";
    if (bpm > 100) return "medical-warning-text";
    if (bpm < 60) return "medical-warning-text";
    return "medical-normal-text";
  };

  const getHeartColor = () => {
    if (displayState === 'error') return "text-red-500/80";
    if (!isReliable) return "text-gray-400/60";
    if (bpm > 100) return "text-orange-500";
    if (bpm < 60) return "text-blue-500";
    return "text-red-500";
  };

  const getReliabilityIndicator = () => {
    if (displayState === 'error') return "error";
    if (confidence > 0.8) return "high";
    if (confidence > 0.5) return "medium";
    return "low";
  };

  // Enhanced debug logging
  useEffect(() => {
    console.log("HeartRateDisplay values:", { 
      bpm, 
      confidence, 
      isReliable, 
      displayValue: bpm > 0 ? bpm : '--',
      reliability: getReliabilityIndicator(),
      displayState,
      errorCount
    });
  }, [bpm, confidence, isReliable, displayState, errorCount]);
  
  // Render fallback for error state with recovery after a delay
  if (displayState === 'error' && errorCount > 3) {
    // Auto-recovery after a few errors
    setTimeout(() => {
      setDisplayState('loading');
      setErrorCount(0);
    }, 3000);
    
    return (
      <div 
        ref={containerRef} 
        className="glass-card-dark p-3 text-center animation-hardware-accelerated rounded-lg bg-red-500/5"
      >
        <div className="flex items-center justify-center gap-1 mb-1">
          <h3 className="text-gray-400/90 text-sm typography-clinical">Heart Rate</h3>
          <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
        </div>
        
        <div className="flex items-baseline justify-center gap-1">
          <Heart 
            className="h-4 w-4 mr-0.5 text-red-500/80 animate-pulse"
            fill="none"
            strokeWidth={1.5}
          />
          <span className="text-2xl font-bold typography-medical-data text-red-500/80">
            Error
          </span>
        </div>
        
        <div className="mt-1.5 w-full bg-gray-700/30 rounded-full h-0.5 overflow-hidden">
          <div className="h-full rounded-full animation-smooth bg-red-500 animate-pulse"
            style={{ width: '30%' }} />
        </div>
      </div>
    );
  }

  // Normal rendering path
  return (
    <div 
      ref={containerRef}
      className={`glass-card-dark p-3 text-center animation-hardware-accelerated rounded-lg ${
        displayState === 'error' ? 'bg-red-500/5' : 
        displayState === 'loading' ? 'bg-blue-500/5' : ''
      }`}
      data-bpm={bpm}
      data-confidence={confidence}
      data-state={displayState}
    >
      <div className="flex items-center justify-center gap-1 mb-1">
        <h3 className="text-gray-400/90 text-sm typography-clinical">Heart Rate</h3>
        
        {getReliabilityIndicator() === "low" && (
          <div className="relative" title="Signal quality is low">
            <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
          </div>
        )}
        
        {displayState === 'error' && (
          <div className="relative" title="Error in data">
            <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
          </div>
        )}
      </div>
      
      <div className="flex items-baseline justify-center gap-1">
        <Heart 
          className={`h-4 w-4 mr-0.5 ${getHeartColor()} animation-smooth will-change-transform ${
            displayState === 'loading' ? 'animate-pulse' :
            isAnimating ? 'scale-150 opacity-80' : 'scale-100 opacity-100'
          }`}
          fill={isReliable && displayState !== 'error' ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
        <span className={`text-2xl font-bold typography-medical-data ${getValueClass()}`}>
          {displayState === 'loading' ? '--' : 
           displayState === 'error' ? 'ER' : 
           bpm > 0 ? bpm : '--'}
        </span>
        <span className="text-gray-400/90 text-xs unit-text">BPM</span>
      </div>
      
      {/* Signal amplification indicator */}
      {(confidence > 0 || displayState !== 'normal') && (
        <div className="mt-1.5 w-full bg-gray-700/30 rounded-full h-0.5 overflow-hidden">
          <div 
            className={`h-full rounded-full animation-smooth ${
              displayState === 'loading' ? 'bg-blue-500 animate-pulse' :
              displayState === 'error' ? 'bg-red-500' :
              confidence > 0.8 ? 'bg-green-500' : 
              confidence > 0.5 ? 'bg-yellow-500' : 
              'bg-red-500'
            }`}
            style={{ 
              width: displayState === 'loading' ? '50%' : 
                     displayState === 'error' ? '30%' :
                     `${Math.min(100, confidence * 100)}%` 
            }}
          />
        </div>
      )}
      
      {/* Auto-recovery message for errors */}
      {displayState === 'error' && (
        <div className="mt-1 text-xs text-red-500/80">
          Recuperando...
        </div>
      )}
    </div>
  );
});

HeartRateDisplay.displayName = 'HeartRateDisplay';

export default HeartRateDisplay;
