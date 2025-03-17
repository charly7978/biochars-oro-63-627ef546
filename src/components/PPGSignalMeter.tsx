
import React, { useRef, useEffect, useState } from 'react';

interface PPGSignalMeterProps {
  value: number;
  quality: number;
  isFingerDetected: boolean;
  onStartMeasurement: () => void;
  onReset: () => void;
  arrhythmiaStatus?: string;
  preserveResults?: boolean;
  rawArrhythmiaData?: any;
}

const PPGSignalMeter: React.FC<PPGSignalMeterProps> = ({
  value,
  quality,
  isFingerDetected,
  onStartMeasurement,
  onReset,
  arrhythmiaStatus = "--",
  preserveResults = false,
  rawArrhythmiaData
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [signalHistory, setSignalHistory] = useState<number[]>([]);
  const maxHistoryLength = 200;
  
  // Scale factor for visualization
  const scaleFactorRef = useRef(50);
  
  // Animation frame reference
  const animationFrameRef = useRef<number | null>(null);
  
  // Canvas context reference to avoid recreating it
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  
  // Handle value changes
  useEffect(() => {
    // Only update signal history if finger is detected or we're preserving results
    if (isFingerDetected || preserveResults) {
      setSignalHistory(prev => {
        const newHistory = [...prev, value];
        if (newHistory.length > maxHistoryLength) {
          return newHistory.slice(-maxHistoryLength);
        }
        return newHistory;
      });
    } else if (signalHistory.length > 0) {
      // Clear history when finger is removed
      setSignalHistory([]);
    }
  }, [value, isFingerDetected, preserveResults]);
  
  // Draw signal on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Get or create context
    if (!contextRef.current) {
      contextRef.current = canvas.getContext('2d');
    }
    const ctx = contextRef.current;
    if (!ctx) return;
    
    // Set canvas dimensions to match its display size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    // Scale all drawing operations by the dpr
    ctx.scale(dpr, dpr);
    
    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    // No data to draw
    if (signalHistory.length < 2) return;

    // Draw signal
    const drawSignal = () => {
      if (!ctx || !canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      
      // Clear the canvas
      ctx.clearRect(0, 0, width, height);
      
      // Calculate x and y step
      const xStep = width / (maxHistoryLength - 1);
      const zeroY = height / 2;
      
      // Adaptive scale factor based on signal magnitude
      const maxValue = Math.max(0.1, ...signalHistory.map(val => Math.abs(val)));
      scaleFactorRef.current = Math.min(150, height / (maxValue * 4));
      
      // Start drawing path
      ctx.beginPath();
      ctx.strokeStyle = isFingerDetected ? 'rgba(0, 255, 100, 0.8)' : 'rgba(255, 100, 100, 0.8)';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      
      // Draw the signal line
      signalHistory.forEach((val, index) => {
        const x = width - (signalHistory.length - index) * xStep;
        const y = zeroY - val * scaleFactorRef.current;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
      
      // Draw zero line
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.moveTo(0, zeroY);
      ctx.lineTo(width, zeroY);
      ctx.stroke();
      
      // Draw finger detection status
      ctx.fillStyle = isFingerDetected ? 'rgba(0, 255, 100, 0.8)' : 'rgba(255, 100, 100, 0.8)';
      ctx.font = '16px Arial';
      ctx.textAlign = 'left';
      
      const statusText = isFingerDetected ? 'Finger Detected' : 'Place Finger on Camera';
      ctx.fillText(statusText, 10, 30);
      
      // Draw quality
      ctx.fillStyle = quality > 60 ? 'rgba(0, 255, 100, 0.8)' : 
                      quality > 30 ? 'rgba(255, 255, 0, 0.8)' : 
                      'rgba(255, 100, 100, 0.8)';
                      
      ctx.fillText(`Signal Quality: ${quality.toFixed(0)}%`, 10, 60);
    };
    
    // Cancel any existing animation frame
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Request new animation frame
    animationFrameRef.current = requestAnimationFrame(drawSignal);
    
    // Cleanup function
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [signalHistory, isFingerDetected, quality]);
  
  return (
    <div className="relative w-full h-full flex flex-col">
      <canvas 
        ref={canvasRef}
        className="w-full h-full bg-black/60"
        style={{ touchAction: 'none' }}
      />
    </div>
  );
};

export default PPGSignalMeter;
