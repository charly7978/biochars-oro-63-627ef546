
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { CircularBuffer, PPGDataPoint } from '../utils/CircularBuffer';

interface PPGSignalMeterProps {
  value: number;
  quality: number;
  isFingerDetected: boolean;
  onStartMeasurement: () => void;
  onReset: () => void;
  arrhythmiaStatus?: string;
  rawArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  preserveResults?: boolean;
}

const PPGSignalMeter = ({ 
  value, 
  quality, 
  isFingerDetected,
  onStartMeasurement,
  onReset,
  arrhythmiaStatus,
  rawArrhythmiaData,
  preserveResults = false
}: PPGSignalMeterProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataBufferRef = useRef<CircularBuffer | null>(null);
  const baselineRef = useRef<number | null>(null);
  const lastValueRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);
  const lastArrhythmiaTime = useRef<number>(0);
  const arrhythmiaCountRef = useRef<number>(0);
  const peaksRef = useRef<{time: number, value: number, isArrhythmia: boolean}[]>([]);
  const [showArrhythmiaAlert, setShowArrhythmiaAlert] = useState(false);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const WINDOW_WIDTH_MS = 2500;
  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 720;
  const GRID_SIZE_X = 20;
  const GRID_SIZE_Y = 80;
  const verticalScale = 48.0;
  const SMOOTHING_FACTOR = 1.5;
  const TARGET_FPS = 60;
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 700;
  const PEAK_DETECTION_WINDOW = 8;
  const PEAK_THRESHOLD = 3;
  const MIN_PEAK_DISTANCE_MS = 200;
  const MAX_PEAKS_TO_DISPLAY = 25;

  // Initialize buffer and offscreen canvas on mount
  useEffect(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer(BUFFER_SIZE);
      console.log("PPGSignalMeter: Buffer initialized with size", BUFFER_SIZE);
    }
    
    if (!offscreenCanvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      offscreenCanvasRef.current = canvas;
      console.log("PPGSignalMeter: Offscreen canvas created");
    }
    
    // Reset buffer if needed
    if (preserveResults && !isFingerDetected) {
      if (dataBufferRef.current) {
        dataBufferRef.current.clear();
      }
      peaksRef.current = [];
      baselineRef.current = null;
      lastValueRef.current = null;
    }
  }, [preserveResults, isFingerDetected]);

  const getQualityColor = useCallback((q: number) => {
    if (!isFingerDetected) return 'from-gray-400 to-gray-500';
    if (q > 75) return 'from-green-500 to-emerald-500';
    if (q > 50) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  }, [isFingerDetected]);

  const getQualityText = useCallback((q: number) => {
    if (!isFingerDetected) return 'Sin detección';
    if (q > 75) return 'Señal óptima';
    if (q > 50) return 'Señal aceptable';
    return 'Señal débil';
  }, [isFingerDetected]);

  const smoothValue = useCallback((currentValue: number, previousValue: number | null): number => {
    if (previousValue === null) return currentValue;
    return previousValue + SMOOTHING_FACTOR * (currentValue - previousValue);
  }, []);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    // Create a more sophisticated gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#E5DEFF'); // Soft purple (top)
    gradient.addColorStop(0.3, '#FDE1D3'); // Soft peach (upper middle)
    gradient.addColorStop(0.7, '#F2FCE2'); // Soft green (lower middle)
    gradient.addColorStop(1, '#D3E4FD'); // Soft blue (bottom)
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Add subtle texture pattern
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < CANVAS_WIDTH; i += 20) {
      for (let j = 0; j < CANVAS_HEIGHT; j += 20) {
        ctx.fillStyle = j % 40 === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
        ctx.fillRect(i, j, 10, 10);
      }
    }
    ctx.globalAlpha = 1.0;
    
    // Draw improved grid lines
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.2)'; // More subtle grid lines
    ctx.lineWidth = 0.5;
    
    // Draw vertical grid lines
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE_X) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      if (x % (GRID_SIZE_X * 5) === 0) {
        ctx.fillStyle = 'rgba(50, 50, 50, 0.6)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(x.toString(), x, CANVAS_HEIGHT - 5);
      }
    }
    
    // Draw horizontal grid lines
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE_Y) {
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      if (y % (GRID_SIZE_Y * 5) === 0) {
        ctx.fillStyle = 'rgba(50, 50, 50, 0.6)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(y.toString(), 15, y + 3);
      }
    }
    ctx.stroke();
    
    // Draw center line (baseline) with improved style
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]); // Dashed line for the center
    ctx.moveTo(0, CANVAS_HEIGHT / 2);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
    ctx.stroke();
    ctx.setLineDash([]); // Reset to solid line
    
    // Draw arrhythmia status if present
    if (arrhythmiaStatus) {
      const [status, count] = arrhythmiaStatus.split('|');
      
      if (status.includes("ARRITMIA") && count === "1" && !showArrhythmiaAlert) {
        // Create a highlight box for the first arrhythmia
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        ctx.fillRect(30, 70, 350, 40);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(30, 70, 350, 40);
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 24px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('¡PRIMERA ARRITMIA DETECTADA!', 45, 95);
        setShowArrhythmiaAlert(true);
      } else if (status.includes("ARRITMIA") && Number(count) > 1) {
        // Create a highlight box for multiple arrhythmias
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        ctx.fillRect(30, 70, 250, 40);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(30, 70, 250, 40);
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 24px Inter';
        ctx.textAlign = 'left';
        ctx.fillText(`Arritmias detectadas: ${count}`, 45, 95);
      }
    }
  }, [arrhythmiaStatus, showArrhythmiaAlert]);

  const detectPeaks = useCallback((points: PPGDataPoint[], now: number) => {
    if (points.length < PEAK_DETECTION_WINDOW) return;
    
    const potentialPeaks: {index: number, value: number, time: number, isArrhythmia: boolean}[] = [];
    
    for (let i = PEAK_DETECTION_WINDOW; i < points.length - PEAK_DETECTION_WINDOW; i++) {
      const currentPoint = points[i];
      
      const recentlyProcessed = peaksRef.current.some(
        peak => Math.abs(peak.time - currentPoint.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (recentlyProcessed) continue;
      
      let isPeak = true;
      
      for (let j = i - PEAK_DETECTION_WINDOW; j < i; j++) {
        if (points[j].value >= currentPoint.value) {
          isPeak = false;
          break;
        }
      }
      
      if (isPeak) {
        for (let j = i + 1; j <= i + PEAK_DETECTION_WINDOW; j++) {
          if (j < points.length && points[j].value > currentPoint.value) {
            isPeak = false;
            break;
          }
        }
      }
      
      if (isPeak && Math.abs(currentPoint.value) > PEAK_THRESHOLD) {
        potentialPeaks.push({
          index: i,
          value: currentPoint.value,
          time: currentPoint.time,
          isArrhythmia: currentPoint.isArrhythmia
        });
      }
    }
    
    for (const peak of potentialPeaks) {
      const tooClose = peaksRef.current.some(
        existingPeak => Math.abs(existingPeak.time - peak.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (!tooClose) {
        peaksRef.current.push({
          time: peak.time,
          value: peak.value,
          isArrhythmia: peak.isArrhythmia
        });
      }
    }
    
    peaksRef.current.sort((a, b) => a.time - b.time);
    
    peaksRef.current = peaksRef.current
      .filter(peak => now - peak.time < WINDOW_WIDTH_MS)
      .slice(-MAX_PEAKS_TO_DISPLAY);
  }, []);

  const renderSignal = useCallback(() => {
    if (!canvasRef.current || !dataBufferRef.current) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const currentTime = performance.now();
    const timeSinceLastRender = currentTime - lastRenderTimeRef.current;
    
    if (timeSinceLastRender < FRAME_TIME) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const now = Date.now();
    
    // Use offscreen canvas for better performance
    const offScreenCanvas = offscreenCanvasRef.current;
    if (!offScreenCanvas) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const offCtx = offScreenCanvas.getContext('2d', { alpha: false });
    if (!offCtx) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    // Draw to offscreen canvas
    drawGrid(offCtx);
    
    if (preserveResults && !isFingerDetected) {
      // Copy offscreen to visible canvas
      ctx.drawImage(offScreenCanvas, 0, 0);
      lastRenderTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    if (isFingerDetected) {
      if (baselineRef.current === null) {
        baselineRef.current = value;
      } else {
        baselineRef.current = baselineRef.current * 0.95 + value * 0.05;
      }
      
      const smoothedValue = smoothValue(value, lastValueRef.current);
      lastValueRef.current = smoothedValue;
      
      const normalizedValue = (baselineRef.current || 0) - smoothedValue;
      const scaledValue = normalizedValue * verticalScale;
      
      let isArrhythmia = false;
      if (rawArrhythmiaData && 
          arrhythmiaStatus?.includes("ARRITMIA") && 
          now - rawArrhythmiaData.timestamp < 1000) {
        isArrhythmia = true;
        lastArrhythmiaTime.current = now;
      }
      
      const dataPoint: PPGDataPoint = {
        time: now,
        value: scaledValue,
        isArrhythmia
      };
      
      dataBufferRef.current.push(dataPoint);
    }
    
    const points = dataBufferRef.current.getPoints();
    detectPeaks(points, now);
    
    if (points.length > 1) {
      offCtx.beginPath();
      offCtx.strokeStyle = '#0EA5E9';
      offCtx.lineWidth = 2;
      offCtx.lineJoin = 'round';
      offCtx.lineCap = 'round';
      
      let firstPoint = true;
      
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        
        const x = canvas.width - ((now - point.time) * canvas.width / WINDOW_WIDTH_MS);
        const y = canvas.height / 2 - point.value;
        
        if (x < 0 || x > canvas.width) continue;
        
        if (firstPoint) {
          offCtx.moveTo(x, y);
          firstPoint = false;
        } else {
          offCtx.lineTo(x, y);
        }
        
        if (point.isArrhythmia) {
          offCtx.stroke();
          offCtx.beginPath();
          offCtx.strokeStyle = '#DC2626';
          
          // If this is the first point after identifying new stroke, move to it
          if (i > 0) {
            const prevPoint = points[i-1];
            const prevX = canvas.width - ((now - prevPoint.time) * canvas.width / WINDOW_WIDTH_MS);
            const prevY = canvas.height / 2 - prevPoint.value;
            offCtx.moveTo(prevX, prevY);
          }
          
          offCtx.lineTo(x, y);
          offCtx.stroke();
          offCtx.beginPath();
          offCtx.strokeStyle = '#0EA5E9';
          offCtx.moveTo(x, y);
          firstPoint = false;
        }
      }
      
      offCtx.stroke();
      
      // Draw peaks with values
      peaksRef.current.forEach(peak => {
        const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
        const y = canvas.height / 2 - peak.value;
        
        if (x >= 0 && x <= canvas.width) {
          // Draw glow effect first
          const gradient = offCtx.createRadialGradient(x, y, 3, x, y, 15);
          gradient.addColorStop(0, peak.isArrhythmia ? 'rgba(254, 202, 202, 0.6)' : 'rgba(14, 165, 233, 0.6)');
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          
          offCtx.beginPath();
          offCtx.arc(x, y, 15, 0, Math.PI * 2);
          offCtx.fillStyle = gradient;
          offCtx.fill();
          
          // Draw circle
          offCtx.beginPath();
          offCtx.arc(x, y, 8, 0, Math.PI * 2);
          offCtx.fillStyle = peak.isArrhythmia ? '#DC2626' : '#0EA5E9';
          offCtx.fill();
          
          // Add white border to circle
          offCtx.beginPath();
          offCtx.arc(x, y, 8, 0, Math.PI * 2);
          offCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          offCtx.lineWidth = 1.5;
          offCtx.stroke();
          
          // Show value in a box
          const displayValue = Math.abs(peak.value / verticalScale).toFixed(2);
          
          offCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          const textWidth = offCtx.measureText(displayValue).width;
          offCtx.fillRect(x - textWidth/2 - 8, y - 30, textWidth + 16, 20);
          
          offCtx.font = 'bold 12px Inter';
          offCtx.fillStyle = 'white';
          offCtx.textAlign = 'center';
          offCtx.fillText(displayValue, x, y - 16);
          
          // Draw time indicator
          const timeDisplay = `${Math.round(now - peak.time)}ms`;
          const timeTextWidth = offCtx.measureText(timeDisplay).width;
          
          offCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          offCtx.fillRect(x - timeTextWidth/2 - 5, y + 15, timeTextWidth + 10, 16);
          
          offCtx.font = '10px Inter';
          offCtx.fillStyle = '#F0F0F0';
          offCtx.fillText(timeDisplay, x, y + 27);
          
          // Special indicator for arrhythmia peaks
          if (peak.isArrhythmia) {
            // Pulsating ring for arrhythmia
            const pulseSize = 12 + Math.sin(now * 0.01) * 2;
            offCtx.beginPath();
            offCtx.arc(x, y, pulseSize, 0, Math.PI * 2);
            offCtx.strokeStyle = '#FEF08A';
            offCtx.lineWidth = 2;
            offCtx.setLineDash([3, 2]);
            offCtx.stroke();
            offCtx.setLineDash([]);
            
            // Arrhythmia label
            const arrLabel = "LATIDO PREMATURO";
            const arrLabelWidth = offCtx.measureText(arrLabel).width;
            
            offCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            offCtx.fillRect(x - arrLabelWidth/2 - 8, y - 55, arrLabelWidth + 16, 22);
            
            offCtx.font = 'bold 14px Inter';
            offCtx.fillStyle = '#FEF08A';
            offCtx.textAlign = 'center';
            offCtx.fillText(arrLabel, x, y - 40);
          }
        }
      });
    }
    
    // Copy offscreen to visible canvas
    ctx.drawImage(offScreenCanvas, 0, 0);
    
    lastRenderTimeRef.current = currentTime;
    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [value, quality, isFingerDetected, rawArrhythmiaData, arrhythmiaStatus, drawGrid, detectPeaks, smoothValue, preserveResults]);

  useEffect(() => {
    renderSignal();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderSignal]);

  const handleReset = useCallback(() => {
    console.log("Resetting PPGSignalMeter");
    setShowArrhythmiaAlert(false);
    peaksRef.current = [];
    
    if (dataBufferRef.current) {
      dataBufferRef.current.clear();
    }
    
    baselineRef.current = null;
    lastValueRef.current = null;
    
    onReset();
  }, [onReset]);

  return (
    <div className="fixed inset-0 bg-black/5 backdrop-blur-[1px]">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-[100vh] absolute inset-0 z-0"
      />

      <div className="absolute top-0 left-0 right-0 p-1 flex justify-between items-center bg-transparent z-10 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-black/80">PPG</span>
          <div className="w-[180px]">
            <div className={`h-1 w-full rounded-full bg-gradient-to-r ${getQualityColor(quality)} transition-all duration-1000 ease-in-out`}>
              <div
                className="h-full rounded-full bg-white/20 animate-pulse transition-all duration-1000"
                style={{ width: `${isFingerDetected ? quality : 0}%` }}
              />
            </div>
            <span className="text-[8px] text-center mt-0.5 font-medium transition-colors duration-700 block" 
                  style={{ color: quality > 60 ? '#0EA5E9' : '#F59E0B' }}>
              {getQualityText(quality)}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <Fingerprint
            className={`h-8 w-8 transition-colors duration-300 ${
              !isFingerDetected ? 'text-gray-400' :
              quality > 75 ? 'text-green-500' :
              quality > 50 ? 'text-yellow-500' :
              'text-red-500'
            }`}
            strokeWidth={1.5}
          />
          <span className="text-[8px] text-center font-medium text-black/80">
            {isFingerDetected ? "Dedo detectado" : "Ubique su dedo"}
          </span>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-[60px] grid grid-cols-2 bg-transparent z-10">
        <button 
          onClick={onStartMeasurement}
          className="bg-transparent text-black/80 hover:bg-white/5 active:bg-white/10 transition-colors duration-200 text-sm font-semibold"
        >
          INICIAR
        </button>
        <button 
          onClick={handleReset}
          className="bg-transparent text-black/80 hover:bg-white/5 active:bg-white/10 transition-colors duration-200 text-sm font-semibold"
        >
          RESET
        </button>
      </div>
    </div>
  );
};

export default PPGSignalMeter;
