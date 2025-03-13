
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Fingerprint } from 'lucide-react';
import { CircularBuffer, PPGDataPoint } from './src/utils/CircularBuffer';

const PPGSignalMeter = ({ 
  value, 
  quality, 
  isFingerDetected,
  onStartMeasurement,
  onReset,
  arrhythmiaStatus,
  detectedPeaks = []
}) => {
  const canvasRef = useRef(null);
  const dataBufferRef = useRef(null);
  const [startTime, setStartTime] = useState(Date.now());
  const animationFrameRef = useRef(null);
  const lastRenderTimeRef = useRef(0);
  const gridCanvasRef = useRef(null);
  const WINDOW_WIDTH_MS = 5000;
  const CANVAS_WIDTH = 1000;
  const CANVAS_HEIGHT = 200;
  const verticalScale = 32.0;
  const baselineRef = useRef(null);
  const lastValueRef = useRef(0);
  const peaksRef = useRef([]);
  
  // Performance optimization references
  const cachedWaveformRef = useRef(null);
  const lastDataLengthRef = useRef(0);
  const renderCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const targetFpsRef = useRef(60);
  const frameTimeThresholdRef = useRef(1000 / 60); // For 60 FPS
  
  // Double-buffering for smoother rendering
  const offscreenCanvasRef = useRef(null);
  const offscreenContextRef = useRef(null);
  
  // Batch processing for improved performance
  const batchSizeRef = useRef(4);
  
  // Constants for peak detection
  const PEAK_DETECTION_WINDOW = 5;
  const PEAK_THRESHOLD = 2;
  const MIN_PEAK_DISTANCE_MS = 300;
  const MAX_PEAKS_TO_DISPLAY = 20;

  // Function to initialize offscreen canvas for double-buffering
  const initOffscreenCanvas = useCallback(() => {
    if (!offscreenCanvasRef.current) {
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = CANVAS_WIDTH;
      offscreenCanvas.height = CANVAS_HEIGHT;
      offscreenCanvasRef.current = offscreenCanvas;
      offscreenContextRef.current = offscreenCanvas.getContext('2d', { 
        alpha: false,
        willReadFrequently: false // Optimizing for write-heavy operations
      });
    }
  }, []);

  // Initialize data buffer
  useEffect(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer(300); // Larger buffer for better analysis
      console.log("PPGSignalMeter: Buffer initialized");
    }
  }, []);

  // Update peaks from detected peaks props
  useEffect(() => {
    if (detectedPeaks && detectedPeaks.length > 0) {
      console.log("Updating peaks from props:", detectedPeaks.length);
      
      // Merge detected peaks with existing peaks, avoid duplicates
      const now = Date.now();
      const recentPeaks = peaksRef.current.filter(p => now - p.time < WINDOW_WIDTH_MS);
      
      // Filter out any peaks that are too close in time to existing ones
      const newPeaks = detectedPeaks.filter(newPeak => {
        return !recentPeaks.some(existingPeak => 
          Math.abs(existingPeak.time - newPeak.time) < 200);
      });
      
      peaksRef.current = [...recentPeaks, ...newPeaks];
      
      // Keep only recent peaks
      peaksRef.current = peaksRef.current.filter(peak => 
        now - peak.time < WINDOW_WIDTH_MS);
    }
  }, [detectedPeaks, WINDOW_WIDTH_MS]);

  const handleReset = () => {
    if (dataBufferRef.current) {
      dataBufferRef.current.clear();
    }
    peaksRef.current = [];
    baselineRef.current = null;
    lastValueRef.current = 0;
    setStartTime(Date.now());
    onReset();
    
    // Reset optimization state
    cachedWaveformRef.current = null;
    lastDataLengthRef.current = 0;
    renderCountRef.current = 0;

    // Clear previous animation loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  // Memoize quality calculations to prevent unnecessary recalculations
  const qualityData = useMemo(() => {
    const qualityColor = () => {
      if (quality > 90) return 'from-emerald-500/80 to-emerald-400/80';
      if (quality > 75) return 'from-sky-500/80 to-sky-400/80';
      if (quality > 60) return 'from-indigo-500/80 to-indigo-400/80';
      if (quality > 40) return 'from-amber-500/80 to-amber-400/80';
      return 'from-red-500/80 to-red-400/80';
    };

    const qualityText = () => {
      if (quality > 90) return 'Excellent';
      if (quality > 75) return 'Very Good';
      if (quality > 60) return 'Good';
      if (quality > 40) return 'Fair';
      return 'Poor';
    };

    return {
      color: qualityColor(),
      text: qualityText()
    };
  }, [quality]);

  // Process signal data and update peaks
  const processSignalData = useCallback(() => {
    if (!dataBufferRef.current || !isFingerDetected) return;
    
    const points = dataBufferRef.current.getPoints();
    if (points.length < PEAK_DETECTION_WINDOW) return;
    
    const now = Date.now();
    const potentialPeaks = [];
    
    // Simple peak detection algorithm
    for (let i = PEAK_DETECTION_WINDOW; i < points.length - PEAK_DETECTION_WINDOW; i++) {
      const currentPoint = points[i];
      
      // Skip points that are already processed
      const recentlyProcessed = peaksRef.current.some(
        peak => Math.abs(peak.time - currentPoint.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (recentlyProcessed) continue;
      
      // Check if current point is higher than previous points
      let isPeak = true;
      for (let j = i - PEAK_DETECTION_WINDOW; j < i; j++) {
        if (points[j].value >= currentPoint.value) {
          isPeak = false;
          break;
        }
      }
      
      // Check if current point is higher than following points
      if (isPeak) {
        for (let j = i + 1; j <= i + PEAK_DETECTION_WINDOW; j++) {
          if (j < points.length && points[j].value > currentPoint.value) {
            isPeak = false;
            break;
          }
        }
      }
      
      // If it's a peak and above threshold, add it to potential peaks
      if (isPeak && Math.abs(currentPoint.value) > PEAK_THRESHOLD) {
        potentialPeaks.push({
          value: currentPoint.value,
          time: currentPoint.time,
          isArrhythmia: arrhythmiaStatus?.includes("ARRITMIA") || currentPoint.isArrhythmia || false
        });
      }
    }
    
    // Add new peaks that are not too close to existing ones
    for (const peak of potentialPeaks) {
      const tooClose = peaksRef.current.some(
        existingPeak => Math.abs(existingPeak.time - peak.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (!tooClose) {
        peaksRef.current.push(peak);
      }
    }
    
    // Sort and limit peaks
    peaksRef.current.sort((a, b) => a.time - b.time);
    peaksRef.current = peaksRef.current
      .filter(peak => now - peak.time < WINDOW_WIDTH_MS)
      .slice(-MAX_PEAKS_TO_DISPLAY);
    
  }, [isFingerDetected, arrhythmiaStatus]);

  // Heavily optimized grid drawing with caching
  const drawBackgroundGrid = useCallback((ctx) => {
    // Create cached grid if it doesn't exist
    if (!gridCanvasRef.current) {
      const gridCanvas = document.createElement('canvas');
      gridCanvas.width = CANVAS_WIDTH;
      gridCanvas.height = CANVAS_HEIGHT;
      const gridCtx = gridCanvas.getContext('2d', { 
        alpha: false,
        willReadFrequently: false
      });
      
      // Draw background
      gridCtx.fillStyle = '#F8FAFC';
      gridCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Draw grid lines
      gridCtx.strokeStyle = 'rgba(51, 65, 85, 0.15)';
      gridCtx.lineWidth = 0.5;
      
      // Batch horizontal and vertical lines to reduce draw calls
      gridCtx.beginPath();
      for (let i = 0; i < 40; i++) {
        const x = CANVAS_WIDTH - (CANVAS_WIDTH * (i / 40));
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, CANVAS_HEIGHT);
      }
      
      const amplitudeLines = 10;
      for (let i = 0; i <= amplitudeLines; i++) {
        const y = (CANVAS_HEIGHT / amplitudeLines) * i;
        gridCtx.moveTo(0, y);
        gridCtx.lineTo(CANVAS_WIDTH, y);
      }
      gridCtx.stroke();
      
      // Add text labels in a separate pass (can't batch with lines)
      gridCtx.fillStyle = 'rgba(51, 65, 85, 0.5)';
      gridCtx.font = '12px Inter';
      for (let i = 0; i < 40; i++) {
        if (i % 4 === 0) {
          const x = CANVAS_WIDTH - (CANVAS_WIDTH * (i / 40));
          gridCtx.fillText(`${i * 50}ms`, x - 25, CANVAS_HEIGHT - 5);
        }
      }
      
      // Add midline
      gridCtx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
      gridCtx.lineWidth = 1;
      gridCtx.beginPath();
      gridCtx.moveTo(0, CANVAS_HEIGHT / 2);
      gridCtx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
      gridCtx.stroke();
      
      gridCanvasRef.current = gridCanvas;
    }
    
    // Use cached grid (much faster than redrawing)
    ctx.drawImage(gridCanvasRef.current, 0, 0);
  }, []);

  // Optimized rendering function with adaptive FPS and double buffering
  const renderOptimizedSignal = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      animationFrameRef.current = requestAnimationFrame(renderOptimizedSignal);
      return;
    }
    
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(renderOptimizedSignal);
      return;
    }
    
    // Initialize offscreen canvas for double-buffering
    initOffscreenCanvas();
    
    // Adaptive frame rate control
    const now = performance.now();
    const elapsed = now - lastFrameTimeRef.current;
    
    // Only render when necessary to maintain target FPS
    if (elapsed >= frameTimeThresholdRef.current || lastDataLengthRef.current !== (dataBufferRef.current?.getPoints().length || 0)) {
      // Use double buffering: draw to offscreen canvas first
      const offCtx = offscreenContextRef.current;
      
      // Draw grid to offscreen canvas
      drawBackgroundGrid(offCtx);
      
      const currentTime = Date.now();
      
      // Process signal data to update peaks
      processSignalData();
      
      // High-performance waveform rendering
      if (dataBufferRef.current && dataBufferRef.current.getPoints().length > 1) {
        // Process points in optimized batches
        const data = dataBufferRef.current.getPoints();
        const dataLength = data.length;
        
        // Use a single stroke operation per wave when possible
        offCtx.lineWidth = 3;
        offCtx.strokeStyle = '#0ea5e9';
        offCtx.beginPath();
        
        // Process all segments at once
        let isFirstPoint = true;
        
        for (let i = 0; i < dataLength; i++) {
          const point = data[i];
          const x = CANVAS_WIDTH - ((currentTime - point.time) * CANVAS_WIDTH / WINDOW_WIDTH_MS);
          const y = CANVAS_HEIGHT / 2 + point.value;
          
          if (isFirstPoint) {
            offCtx.moveTo(x, y);
            isFirstPoint = false;
          } else {
            offCtx.lineTo(x, y);
          }
        }
        
        offCtx.stroke();
        
        // Draw peak circles with values
        const peaks = peaksRef.current;
        if (peaks.length > 0) {
          console.log(`Drawing ${peaks.length} peaks`);
        }
        
        peaks.forEach(peak => {
          const timeSinceNow = currentTime - peak.time;
          if (timeSinceNow <= WINDOW_WIDTH_MS) {
            const x = CANVAS_WIDTH - (timeSinceNow * CANVAS_WIDTH / WINDOW_WIDTH_MS);
            const y = CANVAS_HEIGHT / 2 + peak.value;
            
            // Draw glow effect first for peaks
            offCtx.beginPath();
            const gradient = offCtx.createRadialGradient(x, y, 3, x, y, 15);
            if (peak.isArrhythmia) {
              gradient.addColorStop(0, 'rgba(254, 240, 138, 0.6)'); // Yellow glow for arrhythmia
              gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            } else {
              gradient.addColorStop(0, 'rgba(14, 165, 233, 0.6)'); // Blue glow for normal peaks
              gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            }
            offCtx.arc(x, y, 15, 0, Math.PI * 2);
            offCtx.fillStyle = gradient;
            offCtx.fill();
            
            // Draw circle at peak
            offCtx.beginPath();
            offCtx.arc(x, y, 8, 0, Math.PI * 2);
            offCtx.fillStyle = peak.isArrhythmia ? '#FEF08A' : '#0ea5e9';
            offCtx.fill();
            
            // Draw white stroke around circle
            offCtx.beginPath();
            offCtx.arc(x, y, 8, 0, Math.PI * 2);
            offCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            offCtx.lineWidth = 1.5;
            offCtx.stroke();
            
            // Add value label
            offCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            offCtx.fillRect(x - 20, y - 30, 40, 20);
            
            offCtx.font = '10px Arial';
            offCtx.fillStyle = 'white';
            offCtx.textAlign = 'center';
            const displayValue = Math.abs(peak.value / verticalScale).toFixed(3);
            offCtx.fillText(displayValue, x, y - 15);
            
            // Add time label
            offCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            offCtx.fillRect(x - 20, y + 10, 40, 15);
            offCtx.fillStyle = 'white';
            offCtx.fillText(`${Math.round(timeSinceNow)}ms`, x, y + 20);
            
            // Special label for arrhythmia peaks with flashing animation
            if (peak.isArrhythmia) {
              // Pulsating ring around arrhythmia peaks
              const pulseSize = 15 + Math.sin(currentTime * 0.01) * 2;
              offCtx.beginPath();
              offCtx.arc(x, y, pulseSize, 0, Math.PI * 2);
              offCtx.strokeStyle = '#FEF08A';
              offCtx.lineWidth = 2;
              offCtx.setLineDash([3, 2]);
              offCtx.stroke();
              offCtx.setLineDash([]);
              
              // "LATIDO PREMATURO" label for arrhythmia
              offCtx.font = 'bold 12px Arial';
              offCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              offCtx.fillRect(x - 70, y - 55, 140, 20);
              offCtx.fillStyle = '#FEF08A';
              offCtx.fillText("LATIDO PREMATURO", x, y - 40);
            }
          }
        });
      }
      
      // Copy the offscreen canvas to the visible canvas in a single operation
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
      
      lastFrameTimeRef.current = now;
      lastDataLengthRef.current = dataBufferRef.current ? dataBufferRef.current.getPoints().length : 0;
      renderCountRef.current++;
      
      // Adaptive performance adjustment
      if (renderCountRef.current % 60 === 0) {
        // Adjust batch size based on performance 
        const avgRenderTime = elapsed;
        if (avgRenderTime > 20) {
          batchSizeRef.current = Math.min(8, batchSizeRef.current + 1); // Increase batch size if slow
        } else if (avgRenderTime < 10 && batchSizeRef.current > 2) {
          batchSizeRef.current = batchSizeRef.current - 1; // Decrease if very fast
        }
      }
    }
    
    // Schedule next frame
    animationFrameRef.current = requestAnimationFrame(renderOptimizedSignal);
  }, [drawBackgroundGrid, initOffscreenCanvas, processSignalData]);

  useEffect(() => {
    if (!canvasRef.current || !isFingerDetected) return;

    const currentTime = Date.now();
    
    if (baselineRef.current === null) {
      baselineRef.current = value;
    } else {
      baselineRef.current = baselineRef.current * 0.95 + value * 0.05;
    }

    const normalizedValue = (value - (baselineRef.current || 0)) * verticalScale;
    const isWaveStart = lastValueRef.current < 0 && normalizedValue >= 0;
    lastValueRef.current = normalizedValue;
    
    if (dataBufferRef.current) {
      dataBufferRef.current.push({
        time: currentTime,
        value: normalizedValue,
        isArrhythmia: arrhythmiaStatus?.includes("ARRITMIA") || false
      });
    }
  }, [value, quality, isFingerDetected, arrhythmiaStatus]);

  // Separate effect to manage rendering loop lifecycle
  useEffect(() => {
    // Start optimized rendering loop
    if (!animationFrameRef.current) {
      renderOptimizedSignal();
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [renderOptimizedSignal]);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-white to-slate-50/30">
      <div className="absolute top-0 left-0 right-0 p-2 flex justify-between items-center bg-white/60 backdrop-blur-sm border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-xl font-bold text-slate-700">PPG</span>
          <div className="flex flex-col flex-1">
            <div className={`h-1.5 w-[80%] mx-auto rounded-full bg-gradient-to-r ${qualityData.color} transition-all duration-1000 ease-in-out`}>
              <div
                className="h-full rounded-full bg-white/20 animate-pulse transition-all duration-1000"
                style={{ width: `${quality}%` }}
              />
            </div>
            <span className="text-[9px] text-center mt-0.5 font-medium transition-colors duration-700" 
                  style={{ color: quality > 60 ? '#0EA5E9' : '#F59E0B' }}>
              {qualityData.text}
            </span>
          </div>
          
          <div className="flex flex-col items-center">
            <Fingerprint 
              size={56}
              className={`transition-all duration-700 ${
                isFingerDetected 
                  ? 'text-emerald-500 scale-100 drop-shadow-md'
                  : 'text-slate-300 scale-95'
              }`}
            />
            <span className="text-xs font-medium text-slate-600 transition-all duration-700">
              {isFingerDetected ? 'Dedo detectado' : 'Ubique su dedo en el lente'}
            </span>
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-[calc(40vh)] mt-20"
      />

      <div className="fixed bottom-0 left-0 right-0 h-[60px] grid grid-cols-2 gap-px bg-white/80 backdrop-blur-sm border-t border-slate-100">
        <button 
          onClick={onStartMeasurement}
          className="w-full h-full bg-white/80 hover:bg-slate-50/80 text-xl font-bold text-slate-700 transition-all duration-300"
        >
          INICIAR
        </button>
        <button 
          onClick={handleReset}
          className="w-full h-full bg-white/80 hover:bg-slate-50/80 text-xl font-bold text-slate-700 transition-all duration-300"
        >
          RESET
        </button>
      </div>
    </div>
  );
};

export default PPGSignalMeter;
