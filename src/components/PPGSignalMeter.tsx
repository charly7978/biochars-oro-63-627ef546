
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
  const qualityHistoryRef = useRef<number[]>([]);
  const consecutiveFingerFramesRef = useRef<number>(0);
  const lastValueTimeRef = useRef<number>(0);

  // Optimized constants for smoother rendering
  const WINDOW_WIDTH_MS = 4000; // 4 seconds window width
  const CANVAS_WIDTH = 2400;
  const CANVAS_HEIGHT = 1080;
  const GRID_SIZE_X = 35;
  const GRID_SIZE_Y = 5;
  const verticalScale = 40.0;
  const SMOOTHING_FACTOR = 0.3; // Reduced for more immediate response
  const TARGET_FPS = 120; // Maximum fluidity
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 300; // Optimized for performance
  const PEAK_DETECTION_WINDOW = 5; // Better peak detection
  const PEAK_THRESHOLD = 2.2; // Adjusted for more accurate detection
  const MIN_PEAK_DISTANCE_MS = 250; // Minimum time between peaks (prevent duplicates)
  const MAX_PEAKS_TO_DISPLAY = 12; 
  const REQUIRED_FINGER_FRAMES = 1; // Immediate response
  const QUALITY_HISTORY_SIZE = 2;
  const BASELINE_ADAPTATION_RATE = 0.96; // Slower adaptation for more stable baseline
  
  // Critical for synchronized display
  const USE_PRECISE_TIMING = true;
  const FLOW_DIRECTION = 'rtl'; // Right-to-left (newer values appear on the right)
  
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

  // Update quality history
  useEffect(() => {
    qualityHistoryRef.current.push(quality);
    if (qualityHistoryRef.current.length > QUALITY_HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    if (isFingerDetected) {
      consecutiveFingerFramesRef.current++;
    } else {
      consecutiveFingerFramesRef.current = 0;
    }
  }, [quality, isFingerDetected]);

  // Average quality calculation
  const getAverageQuality = useCallback(() => {
    if (qualityHistoryRef.current.length === 0) return 0;
    
    let weightedSum = 0;
    let weightSum = 0;
    
    qualityHistoryRef.current.forEach((q, index) => {
      const weight = index + 1;
      weightedSum += q * weight;
      weightSum += weight;
    });
    
    return weightSum > 0 ? weightedSum / weightSum : 0;
  }, []);

  // Quality color determination
  const getQualityColor = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    const isFingerConfirmed = consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES;
    
    if (!isFingerConfirmed) return 'from-gray-400 to-gray-500';
    if (avgQuality > 65) return 'from-green-500 to-emerald-500';
    if (avgQuality > 40) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  }, [getAverageQuality]);

  // Quality text determination
  const getQualityText = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    const isFingerConfirmed = consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES;
    
    if (!isFingerConfirmed) return 'Sin detección';
    if (avgQuality > 65) return 'Señal óptima';
    if (avgQuality > 40) return 'Señal aceptable';
    return 'Señal débil';
  }, [getAverageQuality]);

  // Optimized smoothing function
  const smoothValue = useCallback((currentValue: number, previousValue: number | null): number => {
    if (previousValue === null) return currentValue;
    return previousValue * SMOOTHING_FACTOR + currentValue * (1 - SMOOTHING_FACTOR);
  }, []);

  // Grid drawing function
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#E5DEFF');
    gradient.addColorStop(0.3, '#FDE1D3');
    gradient.addColorStop(0.7, '#F2FCE2');
    gradient.addColorStop(1, '#D3E4FD');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < CANVAS_WIDTH; i += 20) {
      for (let j = 0; j < CANVAS_HEIGHT; j += 20) {
        ctx.fillStyle = j % 40 === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
        ctx.fillRect(i, j, 10, 10);
      }
    }
    ctx.globalAlpha = 1.0;
    
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.2)';
    ctx.lineWidth = 0.5;
    
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
    
    const centerLineY = (CANVAS_HEIGHT / 2) - 40;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.moveTo(0, centerLineY);
    ctx.lineTo(CANVAS_WIDTH, centerLineY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    if (arrhythmiaStatus) {
      const [status, count] = arrhythmiaStatus.split('|');
      
      if (status.includes("ARRITMIA") && count === "1" && !showArrhythmiaAlert) {
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
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        ctx.fillRect(30, 70, 250, 40);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(30, 70, 250, 40);
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 24px Inter';
        ctx.textAlign = 'left';
        const redPeaksCount = peaksRef.current.filter(peak => peak.isArrhythmia).length;
        ctx.fillText(`Arritmias detectadas: ${count}`, 45, 95);
      }
    }
  }, [arrhythmiaStatus, showArrhythmiaAlert]);

  // Improved peak detection algorithm
  const detectPeaks = useCallback((points: PPGDataPoint[], now: number) => {
    if (points.length < PEAK_DETECTION_WINDOW * 2 + 1) return;
    
    // Examine the most recent points for peak detection
    const recentPoints = points.slice(-Math.min(points.length, 50));
    
    // Clear old peaks that are outside the visible window to prevent buildup
    peaksRef.current = peaksRef.current.filter(peak => now - peak.time < WINDOW_WIDTH_MS);
    
    // Only process middle points (not edges) to ensure we have proper windowing
    for (let i = PEAK_DETECTION_WINDOW; i < recentPoints.length - PEAK_DETECTION_WINDOW; i++) {
      const currentPoint = recentPoints[i];
      
      // Skip if we've recently processed a peak nearby to avoid duplicates
      const recentlyProcessed = peaksRef.current.some(
        peak => Math.abs(peak.time - currentPoint.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (recentlyProcessed) continue;
      
      // Check if current point is higher than all points in window before it
      let isPeak = true;
      for (let j = i - PEAK_DETECTION_WINDOW; j < i; j++) {
        if (recentPoints[j].value >= currentPoint.value) {
          isPeak = false;
          break;
        }
      }
      
      // And check if it's higher than all points in window after it
      if (isPeak) {
        for (let j = i + 1; j <= i + PEAK_DETECTION_WINDOW; j++) {
          if (j < recentPoints.length && recentPoints[j].value > currentPoint.value) {
            isPeak = false;
            break;
          }
        }
      }
      
      // If it's a genuine peak and above threshold, add it
      if (isPeak && Math.abs(currentPoint.value) > PEAK_THRESHOLD) {
        // Check once more that it's not too close to existing peaks
        const tooClose = peaksRef.current.some(
          existingPeak => Math.abs(existingPeak.time - currentPoint.time) < MIN_PEAK_DISTANCE_MS
        );
        
        if (!tooClose) {
          // Add the new peak
          peaksRef.current.push({
            time: currentPoint.time,
            value: currentPoint.value,
            isArrhythmia: currentPoint.isArrhythmia
          });
        }
      }
    }
    
    // Sort peaks by time to ensure correct rendering
    peaksRef.current.sort((a, b) => a.time - b.time);
    
    // Limit the number of peaks to prevent performance issues
    if (peaksRef.current.length > MAX_PEAKS_TO_DISPLAY) {
      peaksRef.current = peaksRef.current.slice(-MAX_PEAKS_TO_DISPLAY);
    }
  }, []);

  // Optimized rendering function with high-precision timing
  const renderSignal = useCallback(() => {
    if (!canvasRef.current || !dataBufferRef.current) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const currentTime = performance.now();
    const timeSinceLastRender = currentTime - lastRenderTimeRef.current;
    
    // Frame rate control for stability
    if (timeSinceLastRender < FRAME_TIME) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true // Critical for reducing latency
    });
    
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    // Use high-precision timing
    const now = USE_PRECISE_TIMING ? performance.now() : Date.now();
    
    // Draw background grid
    drawGrid(ctx);
    
    // Don't update data if preserving results and finger not detected
    if (preserveResults && !isFingerDetected) {
      lastRenderTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    // Process signal data when finger is detected
    if (isFingerDetected && value !== 0) {
      // Use high-precision timestamp
      const pointTimestamp = performance.now();
      lastValueTimeRef.current = pointTimestamp;
      
      // Create or update baseline for normalization
      if (baselineRef.current === null) {
        baselineRef.current = value;
      } else {
        // More stable baseline adaptation
        baselineRef.current = baselineRef.current * BASELINE_ADAPTATION_RATE + 
                            value * (1 - BASELINE_ADAPTATION_RATE);
      }
      
      // Apply minimal smoothing for responsive display
      const smoothedValue = smoothValue(value, lastValueRef.current);
      lastValueRef.current = smoothedValue;
      
      // Normalize and scale the value
      const normalizedValue = baselineRef.current - smoothedValue;
      const scaledValue = normalizedValue * verticalScale;
      
      // Check for arrhythmia
      let isArrhythmia = false;
      if (rawArrhythmiaData && arrhythmiaStatus?.includes("ARRITMIA") && 
          now - rawArrhythmiaData.timestamp < 300) {
        isArrhythmia = true;
        lastArrhythmiaTime.current = now;
      }
      
      // Create a data point with precise timing
      const dataPoint: PPGDataPoint = {
        time: pointTimestamp,
        value: scaledValue,
        isArrhythmia
      };
      
      // Add to buffer
      dataBufferRef.current.push(dataPoint);
    }
    
    // Get all points from buffer and detect peaks
    const points = dataBufferRef.current.getPoints();
    detectPeaks(points, now);
    
    // Render the signal if there are enough points
    if (points.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#0EA5E9';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      let firstPoint = true;
      let lastX = 0;
      let lastY = 0;
      const centerY = (CANVAS_HEIGHT / 2) - 40;
      
      // Create a copy of points to avoid modification during rendering
      const renderPoints = [...points];
      
      // Render each point
      for (let i = 0; i < renderPoints.length; i++) {
        const point = renderPoints[i];
        
        // Calculate x position based on time - critical for correct positioning
        let x;
        if (FLOW_DIRECTION === 'rtl') {
          // Right to left: newer points on right
          x = CANVAS_WIDTH - ((now - point.time) * CANVAS_WIDTH / WINDOW_WIDTH_MS);
        } else {
          // Left to right: newer points on left
          x = (now - point.time) * CANVAS_WIDTH / WINDOW_WIDTH_MS;
        }
        
        // Y position based on signal value
        const y = centerY - point.value;
        
        // Skip points outside visible area
        if (x < 0 || x > CANVAS_WIDTH) continue;
        
        // Start or continue the path
        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
        
        // Handle arrhythmia segments (red)
        if (point.isArrhythmia && i > 0) {
          // Complete current line
          ctx.stroke();
          
          // Draw arrhythmia segment in red
          ctx.beginPath(); 
          ctx.strokeStyle = '#DC2626';
          ctx.moveTo(lastX, lastY);
          ctx.lineTo(x, y);
          ctx.stroke();
          
          // Resume normal line
          ctx.beginPath();
          ctx.strokeStyle = '#0EA5E9';
          ctx.moveTo(x, y);
          firstPoint = true;
        }
        
        lastX = x;
        lastY = y;
      }
      
      // Complete the path
      ctx.stroke();
      
      // Draw detected peaks with precise positioning
      ctx.lineWidth = 2;
      peaksRef.current.forEach((peak) => {
        // Calculate position based on precise timing
        let x;
        if (FLOW_DIRECTION === 'rtl') {
          // Right to left (newer points on right)
          x = CANVAS_WIDTH - ((now - peak.time) * CANVAS_WIDTH / WINDOW_WIDTH_MS);
        } else {
          // Left to right (newer points on left)
          x = (now - peak.time) * CANVAS_WIDTH / WINDOW_WIDTH_MS;
        }
        
        const y = centerY - peak.value;
        
        // Only render peaks that are in the visible area
        if (x >= 0 && x <= CANVAS_WIDTH) {
          // Draw peak circle
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fillStyle = peak.isArrhythmia ? '#DC2626' : '#0EA5E9';
          ctx.fill();
          
          // Highlight arrhythmia peaks
          if (peak.isArrhythmia) {
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.strokeStyle = '#FEF7CD';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.font = 'bold 18px Inter';
            ctx.fillStyle = '#F97316';
            ctx.textAlign = 'center';
            ctx.fillText('ARRITMIA', x, y - 25);
          }
          
          // Display value
          ctx.font = 'bold 16px Inter';
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          ctx.fillText(Math.abs(peak.value / verticalScale).toFixed(2), x, y - 15);
        }
      });
    }
    
    lastRenderTimeRef.current = currentTime;
    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [value, quality, isFingerDetected, rawArrhythmiaData, arrhythmiaStatus, drawGrid, detectPeaks, smoothValue, preserveResults]);

  // Initialize rendering with high priority
  useEffect(() => {
    // Use requestAnimationFrame for optimal performance
    animationFrameRef.current = requestAnimationFrame(renderSignal);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderSignal]);

  // Handle reset
  const handleReset = useCallback(() => {
    setShowArrhythmiaAlert(false);
    peaksRef.current = [];
    if (dataBufferRef.current) {
      dataBufferRef.current.clear();
    }
    baselineRef.current = null;
    lastValueRef.current = null;
    onReset();
  }, [onReset]);

  // Get current quality with smoothing
  const displayQuality = getAverageQuality();
  const displayFingerDetected = consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES;

  return (
    <div className="fixed inset-0 bg-black/5 backdrop-blur-[1px] flex flex-col">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-full absolute inset-0 z-0 object-cover"
      />

      <div className="absolute top-0 left-0 right-0 p-1 flex justify-between items-center bg-transparent z-10 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-black/80">PPG</span>
          <div className="w-[180px]">
            <div className={`h-1 w-full rounded-full bg-gradient-to-r ${getQualityColor(quality)} transition-all duration-1000 ease-in-out`}>
              <div
                className="h-full rounded-full bg-white/20 animate-pulse transition-all duration-1000"
                style={{ width: `${displayFingerDetected ? displayQuality : 0}%` }}
              />
            </div>
            <span className="text-[8px] text-center mt-0.5 font-medium transition-colors duration-700 block" 
                  style={{ color: displayQuality > 60 ? '#0EA5E9' : '#F59E0B' }}>
              {getQualityText(quality)}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <Fingerprint
            className={`h-8 w-8 transition-colors duration-300 ${
              !displayFingerDetected ? 'text-gray-400' :
              displayQuality > 65 ? 'text-green-500' :
              displayQuality > 40 ? 'text-yellow-500' :
              'text-red-500'
            }`}
            strokeWidth={1.5}
          />
          <span className="text-[8px] text-center font-medium text-black/80">
            {displayFingerDetected ? "Dedo detectado" : "Ubique su dedo"}
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
