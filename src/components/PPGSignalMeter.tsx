
import React, { useRef, useEffect } from 'react';
import { SignalProcessor } from '../modules/vital-signs/signal-processor';

interface PPGSignalMeterProps {
  value: number;
  quality: number;
  isFingerDetected: boolean;
  onStartMeasurement: () => void;
  onReset: () => void;
  arrhythmiaStatus: string;
  preserveResults?: boolean;
  isArrhythmia?: boolean;
  rawArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  signalProcessor?: SignalProcessor; // Add shared signal processor
}

const PPGSignalMeter: React.FC<PPGSignalMeterProps> = ({
  value,
  quality,
  isFingerDetected,
  onStartMeasurement,
  onReset,
  arrhythmiaStatus,
  preserveResults = false,
  isArrhythmia = false,
  rawArrhythmiaData = null,
  signalProcessor
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferRef = useRef<number[]>([]);
  const MAX_BUFFER_SIZE = 150;
  
  // Reference to timestamp of last rendered frame
  const lastRenderTimeRef = useRef<number>(0);
  const FPS_TARGET = 30; // Target frames per second
  const FRAME_TIME = 1000 / FPS_TARGET;
  
  // Peak indicators
  const peakTimesRef = useRef<number[]>([]);
  const MAX_PEAK_INDICATORS = 10;
  
  useEffect(() => {
    if (!isFingerDetected && !preserveResults) {
      // Clear buffer if finger not detected and not preserving results
      bufferRef.current = [];
      peakTimesRef.current = [];
    }
    
    // Add value to buffer if finger detected or we're preserving results
    if ((isFingerDetected || preserveResults) && Math.abs(value) > 0) {
      bufferRef.current.push(value);
      
      // Limit buffer size
      if (bufferRef.current.length > MAX_BUFFER_SIZE) {
        bufferRef.current.shift();
      }
    }
    
    // Get peak indices from shared signal processor if available
    if (signalProcessor) {
      const peakIndices = signalProcessor.getPeakIndices();
      const values = signalProcessor.getPPGValues();
      
      // Convert peak indices to positions in our buffer
      const bufferPeaks = peakIndices
        .filter(idx => idx >= values.length - MAX_BUFFER_SIZE)
        .map(idx => idx - (values.length - bufferRef.current.length));
      
      // Record timestamp for each peak (for fade effect)
      bufferPeaks.forEach(peakIdx => {
        if (peakIdx >= 0 && peakIdx < bufferRef.current.length) {
          peakTimesRef.current.push(Date.now());
          
          // Limit peak indicator array
          if (peakTimesRef.current.length > MAX_PEAK_INDICATORS) {
            peakTimesRef.current.shift();
          }
        }
      });
    }
    
    // Throttle rendering to achieve target FPS
    const now = Date.now();
    if (now - lastRenderTimeRef.current < FRAME_TIME) {
      return;
    }
    lastRenderTimeRef.current = now;
    
    renderPPG();
  }, [value, isFingerDetected, preserveResults, signalProcessor]);
  
  const renderPPG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // If buffer is empty, show flat line or message
    if (bufferRef.current.length === 0) {
      drawFlatLine(ctx, canvas);
      return;
    }
    
    // Get max and min values for scaling
    let min = Math.min(...bufferRef.current);
    let max = Math.max(...bufferRef.current);
    
    // Ensure sufficient range by adding padding
    const range = max - min;
    if (range < 0.2) {
      const mid = (max + min) / 2;
      min = mid - 0.1;
      max = mid + 0.1;
    }
    
    // Add 10% padding
    const padding = (max - min) * 0.1;
    min -= padding;
    max += padding;
    
    // Draw grid
    drawGrid(ctx, canvas);
    
    // Draw waveform
    drawWaveform(ctx, canvas, bufferRef.current, min, max);
    
    // Draw peak indicators
    drawPeakIndicators(ctx, canvas);
    
    // Draw quality and arrhythmia indicators
    drawIndicators(ctx, canvas, quality, isArrhythmia);
  };
  
  const drawFlatLine = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const centerY = canvas.height / 2;
    
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.font = '16px Arial';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.fillText('Coloque su dedo en la cámara', canvas.width / 2, centerY - 20);
  };
  
  const drawGrid = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = '#333';
    
    // Vertical grid lines
    for (let x = 0; x < canvas.width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    // Horizontal grid lines
    for (let y = 0; y < canvas.height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  };
  
  const drawWaveform = (
    ctx: CanvasRenderingContext2D, 
    canvas: HTMLCanvasElement, 
    data: number[], 
    min: number, 
    max: number
  ) => {
    if (data.length < 2) return;
    
    const scaleY = (value: number) => {
      // Convert value to Y coordinate
      return canvas.height - ((value - min) / (max - min) * canvas.height);
    };
    
    // Calculate X increment for each point
    const incrementX = canvas.width / (MAX_BUFFER_SIZE - 1);
    
    // Draw signal path
    ctx.beginPath();
    ctx.moveTo(0, scaleY(data[0]));
    
    for (let i = 1; i < data.length; i++) {
      const x = i * incrementX;
      const y = scaleY(data[i]);
      ctx.lineTo(x, y);
    }
    
    // Style based on quality and finger detection
    const baseHue = isFingerDetected ? 120 : 0; // Green if finger detected, red if not
    const adjustedHue = quality > 0 ? baseHue : 0;
    const saturation = 80;
    const lightness = 60;
    
    ctx.strokeStyle = `hsl(${adjustedHue}, ${saturation}%, ${lightness}%)`;
    ctx.lineWidth = 3;
    ctx.stroke();
  };
  
  const drawPeakIndicators = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const now = Date.now();
    const MAX_AGE_MS = 1000; // Fade out after 1 second
    
    peakTimesRef.current.forEach((timestamp, index) => {
      const age = now - timestamp;
      if (age > MAX_AGE_MS) return;
      
      // Calculate opacity based on age
      const opacity = 1 - (age / MAX_AGE_MS);
      
      // Draw peak indicator
      ctx.beginPath();
      ctx.arc(canvas.width - 20, 30 + (index * 15), 5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 0, 0, ${opacity})`;
      ctx.fill();
    });
  };
  
  const drawIndicators = (
    ctx: CanvasRenderingContext2D, 
    canvas: HTMLCanvasElement, 
    quality: number,
    isArrhythmia: boolean
  ) => {
    // Draw quality indicator
    const qualityPercentage = quality / 100;
    ctx.fillStyle = `rgba(${255 - (255 * qualityPercentage)}, ${255 * qualityPercentage}, 0, 0.8)`;
    ctx.fillRect(10, 10, 100 * qualityPercentage, 10);
    
    ctx.strokeStyle = '#555';
    ctx.strokeRect(10, 10, 100, 10);
    
    // Draw arrhythmia indicator if needed
    if (isArrhythmia) {
      ctx.fillStyle = 'rgba(255, 50, 50, 0.8)';
      ctx.beginPath();
      ctx.arc(canvas.width - 20, 20, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  
  return (
    <div className="relative h-full">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full bg-black"
        width={500}
        height={300}
      />
    </div>
  );
};

export default PPGSignalMeter;
