
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Fingerprint, AlertCircle } from 'lucide-react';
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

  // Constants for 20:9 aspect ratio at 2400 x 1080 resolution
  const WINDOW_WIDTH_MS = 4500;
  const CANVAS_WIDTH = 2400;
  const CANVAS_HEIGHT = 1080;
  const verticalScale = 20.0;
  const SMOOTHING_FACTOR = 1.8;
  const TARGET_FPS = 90;
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 600;
  const PEAK_DETECTION_WINDOW = 8;
  const PEAK_THRESHOLD = 2.5;
  const MIN_PEAK_DISTANCE_MS = 250;
  const IMMEDIATE_RENDERING = true;
  const MAX_PEAKS_TO_DISPLAY = 20;
  const BASELINE_ADAPTATION_RATE = 0.05;

  useEffect(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer(BUFFER_SIZE);
    }
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

  const drawSophisticatedBackground = useCallback((ctx: CanvasRenderingContext2D) => {
    // Sophisticated background with subtle gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#0a1929');
    gradient.addColorStop(0.5, '#0c1f30');
    gradient.addColorStop(1, '#0a1929');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Create subtle horizontal lines for a professional look
    ctx.strokeStyle = 'rgba(20, 120, 180, 0.08)';
    ctx.lineWidth = 1;
    
    // Major horizontal lines
    for (let y = 0; y < CANVAS_HEIGHT; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }
    
    // Minor horizontal lines
    ctx.strokeStyle = 'rgba(20, 120, 180, 0.04)';
    for (let y = 0; y < CANVAS_HEIGHT; y += 25) {
      if (y % 100 !== 0) { // Skip where major lines are
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
    }
    
    // Vertical time markers
    ctx.strokeStyle = 'rgba(20, 120, 180, 0.08)';
    for (let x = 0; x < CANVAS_WIDTH; x += 200) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
      
      // Time markers
      if (x > 0) {
        ctx.fillStyle = 'rgba(140, 200, 255, 0.4)';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        const timeMs = Math.round((WINDOW_WIDTH_MS * x) / CANVAS_WIDTH);
        ctx.fillText(`${timeMs}ms`, x, CANVAS_HEIGHT - 10);
      }
    }
    
    // Add softer vertical lines between markers
    ctx.strokeStyle = 'rgba(20, 120, 180, 0.03)';
    for (let x = 0; x < CANVAS_WIDTH; x += 50) {
      if (x % 200 !== 0) { // Skip where major lines are
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
    }
    
    // Central horizontal line for the ECG baseline
    const centerY = CANVAS_HEIGHT / 2;
    ctx.strokeStyle = 'rgba(0, 180, 220, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.moveTo(0, centerY);
    ctx.lineTo(CANVAS_WIDTH, centerY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Add subtle glow effect around the center line
    const glowGradient = ctx.createLinearGradient(0, centerY - 15, 0, centerY + 15);
    glowGradient.addColorStop(0, 'rgba(0, 180, 220, 0)');
    glowGradient.addColorStop(0.5, 'rgba(0, 180, 220, 0.05)');
    glowGradient.addColorStop(1, 'rgba(0, 180, 220, 0)');
    
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, centerY - 15, CANVAS_WIDTH, 30);
    
    // Add elegant scale indicators
    ctx.fillStyle = 'rgba(140, 200, 255, 0.5)';
    ctx.font = '16px Inter';
    
    // Add arrhythmia alert if needed
    if (arrhythmiaStatus) {
      const [status, count] = arrhythmiaStatus.split('|');
      
      if (status.includes("ARRITMIA") && count === "1" && !showArrhythmiaAlert) {
        // Create a more elegant alert box with glass effect
        ctx.fillStyle = 'rgba(220, 38, 38, 0.15)';
        ctx.fillRect(30, 70, 350, 40);
        
        // Add subtle glow around the alert
        const alertGlow = ctx.createRadialGradient(205, 90, 10, 205, 90, 200);
        alertGlow.addColorStop(0, 'rgba(220, 38, 38, 0.1)');
        alertGlow.addColorStop(1, 'rgba(220, 38, 38, 0)');
        ctx.fillStyle = alertGlow;
        ctx.fillRect(0, 50, 410, 80);
        
        // Add border and text
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(30, 70, 350, 40);
        
        ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
        ctx.font = 'bold 24px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('¡PRIMERA ARRITMIA DETECTADA!', 45, 95);
        setShowArrhythmiaAlert(true);
      } else if (status.includes("ARRITMIA") && Number(count) > 1) {
        // Similar styling for ongoing arrhythmia alerts
        ctx.fillStyle = 'rgba(220, 38, 38, 0.15)';
        ctx.fillRect(30, 70, 250, 40);
        
        const alertGlow = ctx.createRadialGradient(155, 90, 10, 155, 90, 150);
        alertGlow.addColorStop(0, 'rgba(220, 38, 38, 0.1)');
        alertGlow.addColorStop(1, 'rgba(220, 38, 38, 0)');
        ctx.fillStyle = alertGlow;
        ctx.fillRect(0, 50, 310, 80);
        
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(30, 70, 250, 40);
        
        ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
        ctx.font = 'bold 24px Inter';
        ctx.textAlign = 'left';
        ctx.fillText(`Arritmias detectadas: ${count}`, 45, 95);
      }
    }
  }, [arrhythmiaStatus, showArrhythmiaAlert, CANVAS_HEIGHT, CANVAS_WIDTH, WINDOW_WIDTH_MS]);

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
    
    if (!IMMEDIATE_RENDERING && timeSinceLastRender < FRAME_TIME) {
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
    
    drawSophisticatedBackground(ctx);
    
    if (preserveResults && !isFingerDetected) {
      lastRenderTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    if (baselineRef.current === null) {
      baselineRef.current = value;
    } else {
      baselineRef.current = baselineRef.current * (1 - BASELINE_ADAPTATION_RATE) + value * BASELINE_ADAPTATION_RATE;
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
    
    const points = dataBufferRef.current.getPoints();
    detectPeaks(points, now);
    
    if (points.length > 1) {
      // Draw ECG-like waveform with glow effect
      const centerY = canvas.height / 2;
      
      // Draw glow effect
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.4)';
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      let firstPoint = true;
      
      for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i - 1];
        const point = points[i];
        
        const x1 = canvas.width - ((now - prevPoint.time) * canvas.width / WINDOW_WIDTH_MS);
        const y1 = centerY - prevPoint.value;
        
        const x2 = canvas.width - ((now - point.time) * canvas.width / WINDOW_WIDTH_MS);
        const y2 = centerY - point.value;
        
        if (firstPoint) {
          ctx.moveTo(x1, y1);
          firstPoint = false;
        }
        
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
      
      // Draw main line with sharper definition
      ctx.beginPath();
      ctx.strokeStyle = '#00e1ff';
      ctx.lineWidth = 3;
      
      firstPoint = true;
      
      for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i - 1];
        const point = points[i];
        
        const x1 = canvas.width - ((now - prevPoint.time) * canvas.width / WINDOW_WIDTH_MS);
        const y1 = centerY - prevPoint.value;
        
        const x2 = canvas.width - ((now - point.time) * canvas.width / WINDOW_WIDTH_MS);
        const y2 = centerY - point.value;
        
        if (firstPoint) {
          ctx.moveTo(x1, y1);
          firstPoint = false;
        }
        
        if (point.isArrhythmia || prevPoint.isArrhythmia) {
          ctx.stroke();
          ctx.beginPath();
          ctx.strokeStyle = '#FF4040';
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.beginPath();
          ctx.strokeStyle = '#00e1ff';
          ctx.moveTo(x2, y2);
          firstPoint = true;
        } else {
          ctx.lineTo(x2, y2);
        }
      }
      
      ctx.stroke();
      
      // Mark peaks with elegant circles and glow
      peaksRef.current.forEach(peak => {
        const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
        const y = centerY - peak.value;
        
        if (x >= 0 && x <= canvas.width) {
          // Draw glow
          const glow = ctx.createRadialGradient(x, y, 0, x, y, 25);
          glow.addColorStop(0, peak.isArrhythmia ? 'rgba(255, 80, 80, 0.7)' : 'rgba(0, 225, 255, 0.7)');
          glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          
          ctx.fillStyle = glow;
          ctx.fillRect(x - 25, y - 25, 50, 50);
          
          // Draw main circle
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fillStyle = peak.isArrhythmia ? '#FF4040' : '#00e1ff';
          ctx.fill();
          
          // Add white center dot
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          
          if (peak.isArrhythmia) {
            // Add warning indicator
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.strokeStyle = '#FF8080';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.font = 'bold 18px Inter';
            ctx.fillStyle = '#FF6060';
            ctx.textAlign = 'center';
            ctx.fillText('ARRITMIA', x, y - 25);
          }
          
          // Show value with better styling
          ctx.font = 'bold 16px Inter';
          ctx.fillStyle = peak.isArrhythmia ? '#FF8080' : '#80E0FF';
          ctx.textAlign = 'center';
          ctx.fillText(Math.abs(peak.value / verticalScale).toFixed(2), x, y - 15);
        }
      });
    }
    
    lastRenderTimeRef.current = currentTime;
    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [value, quality, isFingerDetected, rawArrhythmiaData, arrhythmiaStatus, drawSophisticatedBackground, detectPeaks, smoothValue, preserveResults, WINDOW_WIDTH_MS]);

  useEffect(() => {
    renderSignal();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderSignal]);

  const handleReset = useCallback(() => {
    setShowArrhythmiaAlert(false);
    peaksRef.current = [];
    onReset();
  }, [onReset]);

  return (
    <div className="fixed inset-0 bg-black/10 backdrop-blur-[2px] flex flex-col">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-full absolute inset-0 z-0 object-cover"
      />

      <div className="absolute top-0 left-0 right-0 p-2 flex justify-between items-center bg-transparent z-10 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white/90">PPG</span>
          <div className="w-[180px]">
            <div className={`h-1 w-full rounded-full bg-gradient-to-r ${getQualityColor(quality)} transition-all duration-1000 ease-in-out`}>
              <div
                className="h-full rounded-full bg-white/20 animate-pulse transition-all duration-1000"
                style={{ width: `${isFingerDetected ? quality : 0}%` }}
              />
            </div>
            <span className="text-[8px] text-center mt-0.5 font-medium transition-colors duration-700 block text-white/90">
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
          <span className="text-[8px] text-center font-medium text-white/90">
            {isFingerDetected ? "Dedo detectado" : "Coloque la YEMA del dedo"}
          </span>
        </div>
      </div>

      {/* Improved finger placement guidance with visual indicator */}
      {!isFingerDetected && (
        <div className="absolute top-1/4 left-0 right-0 flex justify-center">
          <div className="bg-black/60 text-white px-6 py-4 rounded-lg text-center max-w-xs shadow-lg border border-cyan-500/20">
            <h3 className="font-bold text-lg mb-2">COLOQUE LA YEMA DEL DEDO</h3>
            <div className="flex justify-center mb-2">
              <div className="relative w-20 h-20">
                {/* Finger pad illustration with glowing effect */}
                <div className="absolute inset-0 bg-amber-100 rounded-full opacity-80 animate-pulse"></div>
                <div className="absolute inset-2 bg-amber-200 rounded-full"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl animate-pulse">👇</span>
                </div>
                <div className="absolute inset-[-5px] rounded-full bg-cyan-400/20 animate-pulse"></div>
              </div>
            </div>
            <p className="text-sm">Apoye suavemente la PARTE PLANA (yema) del dedo sobre la cámara, no la punta. Presione con firmeza pero sin exceso.</p>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 h-[60px] grid grid-cols-2 bg-transparent z-10">
        <button 
          onClick={onStartMeasurement}
          className="bg-transparent text-white/90 hover:bg-white/10 active:bg-white/20 transition-colors duration-200 text-sm font-semibold"
        >
          INICIAR
        </button>
        <button 
          onClick={handleReset}
          className="bg-transparent text-white/90 hover:bg-white/10 active:bg-white/20 transition-colors duration-200 text-sm font-semibold"
        >
          RESET
        </button>
      </div>
    </div>
  );
};

export default PPGSignalMeter;
