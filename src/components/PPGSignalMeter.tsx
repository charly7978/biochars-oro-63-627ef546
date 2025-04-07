
import React, { useEffect, useRef, useCallback, useState, memo } from 'react';
import { Fingerprint, AlertCircle } from 'lucide-react';
import { CircularBuffer, PPGDataPoint } from '../utils/CircularBuffer';
import AppTitle from './AppTitle';

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
  isArrhythmia?: boolean;
}

interface PPGDataPointExtended extends PPGDataPoint {
  isArrhythmia?: boolean;
}

const PPGSignalMeter = memo(({ 
  value, 
  quality, 
  isFingerDetected,
  onStartMeasurement,
  onReset,
  arrhythmiaStatus,
  rawArrhythmiaData,
  preserveResults = false,
  isArrhythmia = false
}: PPGSignalMeterProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataBufferRef = useRef<CircularBuffer<PPGDataPointExtended> | null>(null);
  const baselineRef = useRef<number | null>(null);
  const lastValueRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);
  const lastArrhythmiaTime = useRef<number>(0);
  const arrhythmiaCountRef = useRef<number>(0);
  const peaksRef = useRef<{time: number, value: number, isArrhythmia: boolean, beepPlayed?: boolean}[]>([]);
  const [showArrhythmiaAlert, setShowArrhythmiaAlert] = useState(false);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qualityHistoryRef = useRef<number[]>([]);
  const consecutiveFingerFramesRef = useRef<number>(0);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const arrhythmiaSegmentsRef = useRef<Array<{startTime: number, endTime: number | null}>>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  const pendingBeepPeakIdRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const fpsRef = useRef<number>(60);
  const lastFpsUpdateRef = useRef<number>(Date.now());
  const renderingTooSlowRef = useRef<boolean>(false);
  const processingEnabledRef = useRef<boolean>(true);

  // Constants - Reduced sample rates and buffer sizes
  const WINDOW_WIDTH_MS = 3500;
  const CANVAS_WIDTH = 800; // Reduced from 1200
  const CANVAS_HEIGHT = 400; // Reduced from 600
  const GRID_SIZE_X = 50; // Increased from 25 to draw fewer grid lines
  const GRID_SIZE_Y = 10; // Increased from 5 to draw fewer grid lines
  const verticalScale = 25.0; // Reduced from 35.0
  const SMOOTHING_FACTOR = 1.2; // Reduced from 1.5
  const TARGET_FPS = 30; // Reduced from 60
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 300; // Reduced from 600
  const PEAK_DETECTION_WINDOW = 6; // Reduced from 8
  const PEAK_THRESHOLD = 3;
  const MIN_PEAK_DISTANCE_MS = 300; // Increased from 250
  const IMMEDIATE_RENDERING = false; // Changed to false to limit frame rate
  const MAX_PEAKS_TO_DISPLAY = 15; // Reduced from 25
  const QUALITY_HISTORY_SIZE = 5; // Reduced from 9
  const REQUIRED_FINGER_FRAMES = 3;
  const USE_OFFSCREEN_CANVAS = true;
  const FPS_CHECK_INTERVAL = 2000; // Check FPS every 2 seconds
  const MIN_ACCEPTABLE_FPS = 20;
  const ADAPTIVE_PROCESSING_ENABLED = true; // Enable adaptive processing based on performance

  // Audio settings
  const BEEP_PRIMARY_FREQUENCY = 880;
  const BEEP_SECONDARY_FREQUENCY = 440;
  const BEEP_DURATION = 80;
  const BEEP_VOLUME = 0.8; // Reduced from 0.9
  const MIN_BEEP_INTERVAL_MS = 400; // Increased from 350

  // Initialize audio with simpler setup and lazy loading
  useEffect(() => {
    // Only initialize audio when needed (first beep request)
    const initAudioOnInteraction = () => {
      window.removeEventListener('click', initAudioOnInteraction);
      window.removeEventListener('touchstart', initAudioOnInteraction);
      
      try {
        if (!audioContextRef.current && typeof AudioContext !== 'undefined') {
          audioContextRef.current = new AudioContext({ latencyHint: 'interactive' });
        }
      } catch (err) {
        console.error("PPGSignalMeter: Error inicializando audio context:", err);
      }
    };
    
    // Initialize audio on user interaction
    window.addEventListener('click', initAudioOnInteraction);
    window.addEventListener('touchstart', initAudioOnInteraction);
    
    return () => {
      window.removeEventListener('click', initAudioOnInteraction);
      window.removeEventListener('touchstart', initAudioOnInteraction);
      
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(err => {
          console.error("PPGSignalMeter: Error cerrando audio context:", err);
        });
        audioContextRef.current = null;
      }
    };
  }, []);

  // Simplified beep function that uses less resources
  const playBeep = useCallback(async (volume = BEEP_VOLUME) => {
    try {
      const now = Date.now();
      if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS) {
        return false;
      }
      
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new AudioContext({ latencyHint: 'interactive' });
        } catch (err) {
          console.error("Could not create audio context:", err);
          return false;
        }
      }
      
      if (audioContextRef.current.state !== 'running') {
        try {
          await audioContextRef.current.resume();
        } catch (err) {
          console.error("Could not resume audio context:", err);
          return false;
        }
      }
      
      // Simplified oscillator
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        BEEP_PRIMARY_FREQUENCY,
        audioContextRef.current.currentTime
      );
      
      // Simplified envelope
      gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        volume,
        audioContextRef.current.currentTime + 0.01
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContextRef.current.currentTime + BEEP_DURATION / 1000
      );
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      oscillator.start(audioContextRef.current.currentTime);
      oscillator.stop(audioContextRef.current.currentTime + BEEP_DURATION / 1000 + 0.02);
      
      lastBeepTimeRef.current = now;
      pendingBeepPeakIdRef.current = null;
      
      return true;
    } catch (err) {
      console.error("PPGSignalMeter: Error reproduciendo beep:", err);
      return false;
    }
  }, []);

  // Initialize data buffer and canvases
  useEffect(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer<PPGDataPointExtended>(BUFFER_SIZE);
    }
    
    if (preserveResults && !isFingerDetected) {
      if (dataBufferRef.current) {
        dataBufferRef.current.clear();
      }
      peaksRef.current = [];
      baselineRef.current = null;
      lastValueRef.current = null;
    }
    
    // Create offscreen canvas once
    if (!offscreenCanvasRef.current) {
      const offscreen = document.createElement('canvas');
      offscreen.width = CANVAS_WIDTH;
      offscreen.height = CANVAS_HEIGHT;
      offscreenCanvasRef.current = offscreen;
    }
    
    // Create grid canvas once
    if (!gridCanvasRef.current) {
      const gridCanvas = document.createElement('canvas');
      gridCanvas.width = CANVAS_WIDTH;
      gridCanvas.height = CANVAS_HEIGHT;
      const gridCtx = gridCanvas.getContext('2d', { alpha: false });
      
      if(gridCtx) {
        drawGrid(gridCtx);
        gridCanvasRef.current = gridCanvas;
      }
    }
    
    // Update canvas size in DOM
    if (canvasRef.current) {
      canvasRef.current.width = CANVAS_WIDTH;
      canvasRef.current.height = CANVAS_HEIGHT;
    }
  }, [preserveResults, isFingerDetected]);

  // Quality history tracking
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

  // Performance monitoring effect
  useEffect(() => {
    if (!ADAPTIVE_PROCESSING_ENABLED) return;
    
    const checkPerformance = () => {
      const now = Date.now();
      const elapsed = now - lastFpsUpdateRef.current;
      
      if (elapsed >= FPS_CHECK_INTERVAL) {
        const fps = (frameCountRef.current / elapsed) * 1000;
        fpsRef.current = fps;
        
        // Check if rendering is too slow and adjust processing if needed
        const tooSlow = fps < MIN_ACCEPTABLE_FPS;
        
        if (tooSlow && processingEnabledRef.current) {
          // Reduce processing load
          processingEnabledRef.current = false;
          console.log(`Performance warning: FPS dropped to ${fps.toFixed(1)}, reducing processing`);
        } else if (!tooSlow && !processingEnabledRef.current) {
          // Restore processing
          processingEnabledRef.current = true;
          console.log(`Performance restored: FPS at ${fps.toFixed(1)}, enabling full processing`);
        }
        
        renderingTooSlowRef.current = tooSlow;
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }
    };
    
    const interval = setInterval(checkPerformance, FPS_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Helper functions
  const getAverageQuality = useCallback(() => {
    if (qualityHistoryRef.current.length === 0) return 0;
    
    let sum = 0;
    for (let i = 0; i < qualityHistoryRef.current.length; i++) {
      sum += qualityHistoryRef.current[i];
    }
    return sum / qualityHistoryRef.current.length;
  }, []);

  const getQualityColor = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    
    if (!(consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES)) return 'from-gray-400 to-gray-500';
    if (avgQuality > 65) return 'from-green-500 to-emerald-500';
    if (avgQuality > 40) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  }, [getAverageQuality]);

  const getQualityText = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    
    if (!(consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES)) return 'Sin detección';
    if (avgQuality > 65) return 'Señal óptima';
    if (avgQuality > 40) return 'Señal aceptable';
    return 'Señal débil';
  }, [getAverageQuality]);

  // Simplified smoothing function
  const smoothValue = useCallback((currentValue: number, previousValue: number | null): number => {
    if (previousValue === null) return currentValue;
    return previousValue + SMOOTHING_FACTOR * (currentValue - previousValue);
  }, []);

  // Grid drawing function optimized for less frequent rendering
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    // Create a simple gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#E5DEFF');
    gradient.addColorStop(1, '#D3E4FD');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw grid lines with less detail
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.2)';
    ctx.lineWidth = 0.5;
    
    // Draw vertical grid lines with less frequency
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE_X) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
    }
    
    // Draw horizontal grid lines with less frequency
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE_Y) {
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
    }
    ctx.stroke();
    
    // Draw center line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.moveTo(0, CANVAS_HEIGHT / 2);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw arrhythmia status with simplified rendering
    if (arrhythmiaStatus) {
      const [status, count] = arrhythmiaStatus.split('|');
      
      if (status.includes("ARRITMIA") && count === "1" && !showArrhythmiaAlert) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        ctx.fillRect(30, 50, 250, 30);
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('¡ARRITMIA DETECTADA!', 45, 70);
        setShowArrhythmiaAlert(true);
      } else if (status.includes("ARRITMIA") && Number(count) > 1) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        ctx.fillRect(30, 50, 200, 30);
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'left';
        ctx.fillText(`Arritmias: ${count}`, 45, 70);
      }
    }
  }, [arrhythmiaStatus, showArrhythmiaAlert]);

  // Optimized peak detection with reduced processing
  const detectPeaks = useCallback((points: PPGDataPointExtended[], now: number) => {
    // Skip peak detection if performance is suffering
    if (renderingTooSlowRef.current || !processingEnabledRef.current) {
      return;
    }
    
    if (points.length < PEAK_DETECTION_WINDOW) return;
    
    // Only check the newest points since last detection
    const startIdx = Math.max(0, points.length - PEAK_DETECTION_WINDOW * 3);
    const endIdx = points.length - PEAK_DETECTION_WINDOW;
    
    // Track potential peaks
    for (let i = startIdx; i < endIdx; i++) {
      // Avoid excessive processing
      if (i % 2 !== 0) continue; // Only check every other point
      
      const currentPoint = points[i];
      
      // Skip if already processed
      const recentlyProcessed = peaksRef.current.some(
        peak => Math.abs(peak.time - currentPoint.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (recentlyProcessed) continue;
      
      // Check for peak with simplified algorithm
      let isPeak = true;
      
      // Check before
      for (let j = Math.max(0, i - PEAK_DETECTION_WINDOW); j < i; j += 2) {
        if (points[j].value >= currentPoint.value) {
          isPeak = false;
          break;
        }
      }
      
      // Check after
      if (isPeak) {
        for (let j = i + 2; j <= Math.min(points.length - 1, i + PEAK_DETECTION_WINDOW); j += 2) {
          if (points[j].value > currentPoint.value) {
            isPeak = false;
            break;
          }
        }
      }
      
      // Add peak if it meets criteria
      if (isPeak && Math.abs(currentPoint.value) > PEAK_THRESHOLD) {
        peaksRef.current.push({
          time: currentPoint.time,
          value: currentPoint.value,
          isArrhythmia: currentPoint.isArrhythmia || false,
          beepPlayed: false
        });
      }
    }
    
    // Prune old peaks
    peaksRef.current = peaksRef.current
      .filter(peak => now - peak.time < WINDOW_WIDTH_MS)
      .slice(-MAX_PEAKS_TO_DISPLAY);
  }, []);

  // Optimized rendering loop
  const renderSignal = useCallback(() => {
    frameCountRef.current++;
    
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
    const renderCtx = USE_OFFSCREEN_CANVAS && offscreenCanvasRef.current ? 
      offscreenCanvasRef.current.getContext('2d', { alpha: false }) : 
      canvas.getContext('2d', { alpha: false });
    
    if (!renderCtx) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const now = Date.now();
    
    // Draw grid (background)
    if (gridCanvasRef.current) {
      renderCtx.drawImage(gridCanvasRef.current, 0, 0);
    } else {
      drawGrid(renderCtx);
    }
    
    // Handle preserved results display (static mode)
    if (preserveResults && !isFingerDetected) {
      if (USE_OFFSCREEN_CANVAS && offscreenCanvasRef.current) {
        const visibleCtx = canvas.getContext('2d', { alpha: false });
        if (visibleCtx) {
          visibleCtx.drawImage(offscreenCanvasRef.current, 0, 0);
        }
      }
      
      lastRenderTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    // Process and normalize the signal value
    if (baselineRef.current === null) {
      baselineRef.current = value;
    } else {
      baselineRef.current = baselineRef.current * 0.95 + value * 0.05;
    }
    
    const smoothedValue = smoothValue(value, lastValueRef.current);
    lastValueRef.current = smoothedValue;
    
    const normalizedValue = (baselineRef.current || 0) - smoothedValue;
    const scaledValue = normalizedValue * verticalScale;
    
    // Check for arrhythmia
    let currentIsArrhythmia = false;
    if ((rawArrhythmiaData && 
         arrhythmiaStatus?.includes("ARRITMIA") && 
         now - rawArrhythmiaData.timestamp < 1000) || 
        isArrhythmia) {
      currentIsArrhythmia = true;
      lastArrhythmiaTime.current = now;
    }
    
    // Add data point
    const dataPoint: PPGDataPointExtended = {
      time: now,
      value: scaledValue,
      isArrhythmia: currentIsArrhythmia
    };
    
    dataBufferRef.current.push(dataPoint);
    
    // Get points and detect peaks
    const points = dataBufferRef.current.getPoints();
    detectPeaks(points, now);
    
    let shouldBeep = false;
    
    // Draw PPG signal line
    if (points.length > 1) {
      // Simplified drawing that skips points for better performance
      const skipFactor = renderingTooSlowRef.current ? 3 : 1;
      let lastDrawnPoint: PPGDataPointExtended | null = null;
      let currentPathColor = '#0EA5E9';
      
      renderCtx.beginPath();
      renderCtx.strokeStyle = '#0EA5E9';
      renderCtx.lineWidth = 2;
      renderCtx.lineJoin = 'round';
      renderCtx.lineCap = 'round';
      
      let firstPoint = true;
      
      for (let i = 0; i < points.length; i += skipFactor) {
        const point = points[i];
        
        const x = canvas.width - ((now - point.time) * canvas.width / WINDOW_WIDTH_MS);
        
        // Skip points outside visible area
        if (x < -20 || x > canvas.width + 20) continue;
        
        const y = canvas.height / 2 - point.value;
        
        if (firstPoint) {
          renderCtx.moveTo(x, y);
          firstPoint = false;
          currentPathColor = point.isArrhythmia ? '#DC2626' : '#0EA5E9';
          renderCtx.strokeStyle = currentPathColor;
        } else {
          renderCtx.lineTo(x, y);
        }
        
        lastDrawnPoint = point;
      }
      
      renderCtx.stroke();
      
      // Draw only visible peaks for efficiency
      for (const peak of peaksRef.current) {
        const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
        
        // Skip off-screen peaks
        if (x < -10 || x > canvas.width + 10) continue;
        
        const y = canvas.height / 2 - peak.value;
        
        renderCtx.beginPath();
        renderCtx.arc(x, y, 5, 0, Math.PI * 2);
        renderCtx.fillStyle = peak.isArrhythmia ? '#DC2626' : '#0EA5E9';
        renderCtx.fill();
        
        // Only add special rendering for arrhythmia to save performance
        if (peak.isArrhythmia) {
          renderCtx.beginPath();
          renderCtx.arc(x, y, 10, 0, Math.PI * 2);
          renderCtx.strokeStyle = '#FEF7CD';
          renderCtx.lineWidth = 2;
          renderCtx.stroke();
          
          // Only add text if not in performance-critical mode
          if (!renderingTooSlowRef.current) {
            renderCtx.font = 'bold 16px Inter';
            renderCtx.fillStyle = '#F97316';
            renderCtx.textAlign = 'center';
            renderCtx.fillText('ARRITMIA', x, y - 20);
          }
        }
        
        // Queue beep if needed
        if (!peak.beepPlayed) {
          shouldBeep = true;
          peak.beepPlayed = true;
        }
      }
    }
    
    // Transfer the offscreen canvas to the visible canvas
    if (USE_OFFSCREEN_CANVAS && offscreenCanvasRef.current) {
      const visibleCtx = canvas.getContext('2d', { alpha: false });
      if (visibleCtx) {
        visibleCtx.drawImage(offscreenCanvasRef.current, 0, 0);
      }
    }
    
    // Play beep sound if enabled and conditions met
    if (shouldBeep && isFingerDetected && 
        consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES) {
      playBeep(0.8);
    }
    
    lastRenderTimeRef.current = currentTime;
    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [value, quality, isFingerDetected, rawArrhythmiaData, arrhythmiaStatus, drawGrid, detectPeaks, smoothValue, preserveResults, isArrhythmia, playBeep]);

  // Start and clean up rendering loop
  useEffect(() => {
    renderSignal();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderSignal]);

  // Reset handler
  const handleReset = useCallback(() => {
    setShowArrhythmiaAlert(false);
    peaksRef.current = [];
    arrhythmiaSegmentsRef.current = [];
    pendingBeepPeakIdRef.current = null;
    processingEnabledRef.current = true;
    renderingTooSlowRef.current = false;
    frameCountRef.current = 0;
    fpsRef.current = 60;
    onReset();
  }, [onReset]);

  const displayQuality = getAverageQuality();
  const displayFingerDetected = consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES;

  // Simplified and more efficient render
  return (
    <div className="fixed inset-0 bg-black/5 backdrop-blur-[1px] flex flex-col">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-[100vh] absolute inset-0 z-0 object-cover"
        style={{
          imageRendering: 'crisp-edges'
        }}
      />

      <div className="absolute top-0 left-0 right-0 p-1 flex justify-between items-center bg-transparent z-10 pt-3">
        <div className="flex items-center gap-2 ml-2">
          <span className="text-lg font-bold text-black/80">PPG</span>
          <div className="w-[180px]">
            <div className={`h-1 w-full rounded-full bg-gradient-to-r ${getQualityColor(quality)}`}>
              <div
                className="h-full rounded-full bg-white/20"
                style={{ width: `${displayFingerDetected ? displayQuality : 0}%` }}
              />
            </div>
            <span className="text-[8px] text-center mt-0.5 font-medium block" 
                  style={{ color: displayQuality > 60 ? '#0EA5E9' : '#F59E0B' }}>
              {getQualityText(quality)}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <Fingerprint
            className={`h-8 w-8 ${
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
          className="bg-transparent text-black/80 hover:bg-white/5 active:bg-white/10 text-sm font-semibold"
        >
          INICIAR
        </button>
        <button 
          onClick={handleReset}
          className="bg-transparent text-black/80 hover:bg-white/5 active:bg-white/10 text-sm font-semibold"
        >
          RESET
        </button>
      </div>
    </div>
  );
});

PPGSignalMeter.displayName = 'PPGSignalMeter';

export default PPGSignalMeter;
