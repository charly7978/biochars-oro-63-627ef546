
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Fingerprint } from 'lucide-react';

const PPGSignalMeter = ({ 
  value, 
  quality, 
  isFingerDetected,
  onStartMeasurement,
  onReset,
  arrhythmiaStatus
}) => {
  const canvasRef = useRef(null);
  const dataRef = useRef([]);
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

  const handleReset = () => {
    dataRef.current = [];
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
    if (elapsed >= frameTimeThresholdRef.current || lastDataLengthRef.current !== dataRef.current.length) {
      // Use double buffering: draw to offscreen canvas first
      const offCtx = offscreenContextRef.current;
      
      // Draw grid to offscreen canvas
      drawBackgroundGrid(offCtx);
      
      const currentTime = Date.now();
      
      // High-performance waveform rendering
      if (dataRef.current.length > 1) {
        // Process points in optimized batches
        const batchSize = batchSizeRef.current;
        const data = dataRef.current;
        const dataLength = data.length;
        
        // Use a single stroke operation per wave when possible
        let waveStartIndex = 0;
        let segmentBatches = [];
        
        for (let i = 0; i < dataLength; i++) {
          const point = data[i];
          
          if (point.isWaveStart || i === dataLength - 1) {
            if (i > waveStartIndex) {
              segmentBatches.push({
                start: waveStartIndex,
                end: i
              });
            }
            waveStartIndex = i;
          }
        }
        
        // Render batches in one operation when possible
        if (segmentBatches.length > 0) {
          offCtx.lineWidth = 3;
          offCtx.strokeStyle = '#0ea5e9';
          offCtx.beginPath();
          
          // Process all segments at once
          let isFirstPoint = true;
          
          segmentBatches.forEach(batch => {
            for (let i = batch.start; i <= batch.end; i++) {
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
          });
          
          offCtx.stroke();
        }
      }
      
      // Copy the offscreen canvas to the visible canvas in a single operation
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
      
      lastFrameTimeRef.current = now;
      lastDataLengthRef.current = dataRef.current.length;
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
  }, [drawBackgroundGrid, initOffscreenCanvas]);

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
    
    dataRef.current.push({
      time: currentTime,
      value: normalizedValue,
      isWaveStart,
      isArrhythmia: false
    });

    const cutoffTime = currentTime - WINDOW_WIDTH_MS;
    dataRef.current = dataRef.current.filter(point => point.time >= cutoffTime);
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
