import React, { useEffect, useRef, useCallback, useState, memo } from 'react';
import { Fingerprint } from 'lucide-react';
import { CircularBuffer, PPGDataPoint } from '../utils/CircularBuffer';
import AudioFeedbackService from '../services/AudioFeedbackService';
import ArrhythmiaDetectionService from '../services/ArrhythmiaDetectionService';
import { ArrhythmiaWindow } from '../hooks/vital-signs/types';
import { useHeartbeatFeedback } from '@/hooks/useHeartbeatFeedback';

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
  arrhythmiaWindows?: { start: number, end: number }[];
  signalData?: PPGDataPointExtended[];
  currentBPM?: number;
}

interface PPGDataPointExtended extends PPGDataPoint {
  isArrhythmia?: boolean;
  isPeak?: boolean;
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
  isArrhythmia = false,
  arrhythmiaWindows = [],
  signalData = [],
  currentBPM = 0,
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
  const currentArrhythmiaSegmentRef = useRef<ArrhythmiaWindow | null>(null);
  const lastArrhythmiaStateRef = useRef<boolean>(false);
  const lastBeepTimeRef = useRef<number>(0);
  const pendingBeepPeakIdRef = useRef<number | null>(null);
  const [resultsVisible, setResultsVisible] = useState(true);
  const [displayData, setDisplayData] = useState<PPGDataPointExtended[]>([]);
  const [lastPeakTimestamp, setLastPeakTimestamp] = useState<number>(0);

  const triggerBeep = useHeartbeatFeedback(true);

  const WINDOW_WIDTH_MS = 4500;
  const CANVAS_WIDTH = 1100;
  const CANVAS_HEIGHT = 1200;
  const GRID_SIZE_X = 5;
  const GRID_SIZE_Y = 5;
  const verticalScale = 76.0;
  const SMOOTHING_FACTOR = 1.6;
  const TARGET_FPS = 60;
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 600;
  const PEAK_DETECTION_WINDOW = 8;
  const PEAK_THRESHOLD = 3;
  const MIN_PEAK_DISTANCE_MS = 350;
  const IMMEDIATE_RENDERING = true;
  const MAX_PEAKS_TO_DISPLAY = 25;
  const QUALITY_HISTORY_SIZE = 9;
  const REQUIRED_FINGER_FRAMES = 3;
  const USE_OFFSCREEN_CANVAS = true;
  const MIN_BEEP_INTERVAL_MS = 350;

  const playBeep = useCallback(async (volume: number = 0.7, isArrhythmic: boolean = false) => {
    const now = Date.now();
    if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS) {
      return false;
    }
    
    AudioFeedbackService.playBeep(isArrhythmic ? 'arrhythmia' : 'normal', volume);
    lastBeepTimeRef.current = now;
    return true;
  }, [MIN_BEEP_INTERVAL_MS]);

  useEffect(() => {
    const handleArrhythmiaWindow = (window: ArrhythmiaWindow) => {
      const now = Date.now();
      if (Math.abs(now - window.start) < 1000 || Math.abs(now - window.end) < 1000) {
        playBeep(0.8, true);
      }
    };
    
    ArrhythmiaDetectionService.addArrhythmiaListener(handleArrhythmiaWindow);
    
    return () => {
      ArrhythmiaDetectionService.removeArrhythmiaListener(handleArrhythmiaWindow);
    };
  }, [playBeep]);

  useEffect(() => {
    console.log("PPGSignalMeter: Arrhythmia windows updated:", {
      windowCount: arrhythmiaWindows.length,
      windows: arrhythmiaWindows.map(w => ({
        start: new Date(w.start).toISOString(),
        end: new Date(w.end).toISOString(),
        duration: w.end - w.start
      }))
    });
    
    if (arrhythmiaWindows.length > 0) {
      const now = Date.now();
      const recentWindows = arrhythmiaWindows.filter(w => 
        Math.abs(now - w.start) < 1000 || Math.abs(now - w.end) < 1000
      );
      
      if (recentWindows.length > 0) {
        playBeep(0.8, true);
      }
    }
  }, [arrhythmiaWindows, playBeep]);

  useEffect(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer<PPGDataPointExtended>(BUFFER_SIZE);
    }
    
    if (preserveResults && !isFingerDetected) {
        setResultsVisible(true);
    } else if (!preserveResults && !isFingerDetected) {
        if (dataBufferRef.current) {
          dataBufferRef.current.clear();
        }
        peaksRef.current = [];
        baselineRef.current = null;
        lastValueRef.current = null;
        setResultsVisible(false);
    } else {
        // If isFingerDetected is true, we wait for the other useEffect to confirm consecutive frames
    }
  }, [preserveResults, isFingerDetected]);

  useEffect(() => {
    qualityHistoryRef.current.push(quality);
    if (qualityHistoryRef.current.length > QUALITY_HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    if (isFingerDetected) {
      consecutiveFingerFramesRef.current++;
      // Only set visible after enough consecutive frames
      if (consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES) {
         setResultsVisible(true);
      }
    } else {
      consecutiveFingerFramesRef.current = 0;
      if (!preserveResults) {
        setResultsVisible(false);
      }
    }
  }, [quality, isFingerDetected, preserveResults]);

  useEffect(() => {
    const offscreen = document.createElement('canvas');
    offscreen.width = CANVAS_WIDTH;
    offscreen.height = CANVAS_HEIGHT;
    offscreenCanvasRef.current = offscreen;
    
    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = CANVAS_WIDTH;
    gridCanvas.height = CANVAS_HEIGHT;
    const gridCtx = gridCanvas.getContext('2d', { alpha: false });
    
    if(gridCtx) {
      drawGrid(gridCtx);
      gridCanvasRef.current = gridCanvas;
    }
  }, []);

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

  const getQualityColor = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    
    if (!(consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES) && !preserveResults) return 'from-gray-400 to-gray-500';
    if (avgQuality > 65) return 'from-green-500 to-emerald-500';
    if (avgQuality > 40) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  }, [getAverageQuality, preserveResults]);

  const getQualityText = useCallback((q: number) => {
    const avgQuality = getAverageQuality();

    if (!(consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES) && !preserveResults) return 'Sin detección';
    if (avgQuality > 65) return 'Señal óptima';
    if (avgQuality > 40) return 'Señal aceptable';
    return 'Señal débil';
  }, [getAverageQuality, preserveResults]);

  const smoothValue = useCallback((currentValue: number, previousValue: number | null): number => {
    if (previousValue === null) return currentValue;
    return previousValue + SMOOTHING_FACTOR * (currentValue - previousValue);
  }, []);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    
    gradient.addColorStop(0, '#FFE8E8');
    gradient.addColorStop(0.14, '#FFECDA');
    gradient.addColorStop(0.28, '#FEF7CD');
    gradient.addColorStop(0.42, '#E2FFDA');
    gradient.addColorStop(0.56, '#D6F3FF');
    gradient.addColorStop(0.70, '#E4DAFF');
    gradient.addColorStop(0.84, '#F2D6FF');
    gradient.addColorStop(1, '#3255a4');
    
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
    
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.moveTo(0, CANVAS_HEIGHT / 2 - 50);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2 - 50);
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
  }, [arrhythmiaStatus, showArrhythmiaAlert, CANVAS_HEIGHT, CANVAS_WIDTH, GRID_SIZE_X, GRID_SIZE_Y]);

  const drawArrhythmiaZones = useCallback((ctx: CanvasRenderingContext2D, now: number) => {
    if (!arrhythmiaWindows || arrhythmiaWindows.length === 0) {
      return;
    }
    
    arrhythmiaWindows.forEach((window, index) => {
      const windowStartTime = window.start;
      const windowEndTime = window.end;
      
      const windowVisible = (now - windowStartTime < WINDOW_WIDTH_MS || now - windowEndTime < WINDOW_WIDTH_MS);
      
      if (windowVisible) {
        const startX = ctx.canvas.width - ((now - windowStartTime) * ctx.canvas.width / WINDOW_WIDTH_MS);
        const endX = ctx.canvas.width - ((now - windowEndTime) * ctx.canvas.width / WINDOW_WIDTH_MS);
        const width = Math.max(10, endX - startX);
        
        const adjustedStartX = Math.max(0, startX);
        const adjustedWidth = Math.min(width, ctx.canvas.width - adjustedStartX);
        
        ctx.fillStyle = 'rgba(220, 38, 38, 0.20)';
        ctx.fillRect(adjustedStartX, 0, adjustedWidth, ctx.canvas.height);
        
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        
        if (adjustedStartX >= 0 && adjustedStartX <= ctx.canvas.width) {
          ctx.moveTo(adjustedStartX, 0);
          ctx.lineTo(adjustedStartX, ctx.canvas.height);
        }
        
        if (adjustedStartX + adjustedWidth >= 0 && adjustedStartX + adjustedWidth <= ctx.canvas.width) {
          ctx.moveTo(adjustedStartX + adjustedWidth, 0);
          ctx.lineTo(adjustedStartX + adjustedWidth, ctx.canvas.height);
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
        
        if (adjustedWidth > 50) {
          const textX = adjustedStartX + adjustedWidth/2;
          
          ctx.fillStyle = '#DC2626';
          ctx.font = 'bold 24px Inter';
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
          ctx.shadowBlur = 4;
          ctx.fillText('ARRITMIA', textX, 40);
          ctx.shadowBlur = 0;
          
          ctx.beginPath();
          ctx.fillStyle = 'rgba(220, 38, 38, 0.8)';
          const symbolSize = 22;
          const symbolX = textX;
          const symbolY = 70;
          ctx.moveTo(symbolX, symbolY - symbolSize);
          ctx.lineTo(symbolX + symbolSize, symbolY + symbolSize);
          ctx.lineTo(symbolX - symbolSize, symbolY + symbolSize);
          ctx.closePath();
          ctx.fill();
          
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 20px Inter';
          ctx.textAlign = 'center';
          ctx.fillText('!', symbolX, symbolY + symbolSize - 2);
        }
        
        if (Math.abs(now - windowStartTime) < 500 || Math.abs(now - windowEndTime) < 500) {
          playBeep(0.8, true);
        }
        
        if (Math.abs(now - windowStartTime) < 300) {
          currentArrhythmiaSegmentRef.current = window;
        }
      }
    });
  }, [WINDOW_WIDTH_MS, arrhythmiaWindows, playBeep]);

  const detectPeaks = useCallback((points: PPGDataPointExtended[], now: number) => {
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
        const isInArrhythmiaWindow = arrhythmiaWindows.some(
          window => currentPoint.time >= window.start && currentPoint.time <= window.end
        );
        
        const isPointArrhythmia = currentPoint.isArrhythmia || false;
        
        const finalIsArrhythmia = isInArrhythmiaWindow || isPointArrhythmia || isArrhythmia;
        
        potentialPeaks.push({
          index: i,
          value: currentPoint.value,
          time: currentPoint.time,
          isArrhythmia: finalIsArrhythmia
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
          isArrhythmia: peak.isArrhythmia,
          beepPlayed: false
        });
      }
    }
    
    peaksRef.current.sort((a, b) => a.time - b.time);
    
    peaksRef.current = peaksRef.current
      .filter(peak => now - peak.time < WINDOW_WIDTH_MS)
      .slice(-MAX_PEAKS_TO_DISPLAY);
  }, [MIN_PEAK_DISTANCE_MS, PEAK_DETECTION_WINDOW, PEAK_THRESHOLD, WINDOW_WIDTH_MS, MAX_PEAKS_TO_DISPLAY, arrhythmiaWindows, isArrhythmia]);

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
    const renderCtx = USE_OFFSCREEN_CANVAS && offscreenCanvasRef.current ? 
      offscreenCanvasRef.current.getContext('2d', { alpha: false }) : 
      canvas.getContext('2d', { alpha: false });
    
    if (!renderCtx) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const now = Date.now();
    
    if (gridCanvasRef.current) {
      renderCtx.drawImage(gridCanvasRef.current, 0, 0);
    } else {
      drawGrid(renderCtx);
    }
    
    drawArrhythmiaZones(renderCtx, now);
    
    if (!resultsVisible) {
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
    
    if (baselineRef.current === null) {
      baselineRef.current = value;
    } else {
      baselineRef.current = baselineRef.current * 0.95 + value * 0.05;
    }
    
    const smoothedValue = smoothValue(value, lastValueRef.current);
    lastValueRef.current = smoothedValue;
    
    const normalizedValue = smoothedValue - (baselineRef.current || 0);
    const scaledValue = normalizedValue * verticalScale;
    
    let currentIsArrhythmia = false;
    
    const isInArrhythmiaWindow = arrhythmiaWindows.some(
      window => now >= window.start && now <= window.end
    );
    
    if (rawArrhythmiaData && 
        arrhythmiaStatus?.includes("ARRHYTHMIA DETECTED") && 
        now - rawArrhythmiaData.timestamp < 500) {
      currentIsArrhythmia = true;
      lastArrhythmiaTime.current = now;
    }
    else if (isArrhythmia || isInArrhythmiaWindow) {
      currentIsArrhythmia = true;
      lastArrhythmiaTime.current = now;
    }
    
    const dataPoint: PPGDataPointExtended = {
      time: now,
      value: scaledValue,
      isArrhythmia: currentIsArrhythmia
    };
    
    dataBufferRef.current.push(dataPoint);
    
    const points = dataBufferRef.current.getPoints();
    detectPeaks(points, now);
    
    let shouldBeep = false;
    
    if (points.length > 1) {
      for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i - 1];
        const currentPoint = points[i];
        
        const x1 = canvas.width - ((now - prevPoint.time) * canvas.width / WINDOW_WIDTH_MS);
        const y1 = (canvas.height / 2 - 50) - prevPoint.value;
        
        const x2 = canvas.width - ((now - currentPoint.time) * canvas.width / WINDOW_WIDTH_MS);
        const y2 = (canvas.height / 2 - 50) - currentPoint.value;
        
        const isInArrhythmiaZone = 
          currentPoint.isArrhythmia || 
          prevPoint.isArrhythmia || 
          arrhythmiaWindows.some(window => 
            (currentPoint.time >= window.start && currentPoint.time <= window.end) ||
            (prevPoint.time >= window.start && prevPoint.time <= window.end)
          );
        
        renderCtx.beginPath();
        renderCtx.strokeStyle = isInArrhythmiaZone ? '#DC2626' : '#0EA5E9';
        renderCtx.lineWidth = isInArrhythmiaZone ? 3 : 2;
        renderCtx.moveTo(x1, y1);
        renderCtx.lineTo(x2, y2);
        renderCtx.stroke();
      }
      
      peaksRef.current.forEach(peak => {
        const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
        const y = canvas.height / 2 - 50 - peak.value;
        
        if (x >= 0 && x <= canvas.width) {
          const isInArrhythmiaZone = arrhythmiaWindows.some(window => 
            peak.time >= window.start && peak.time <= window.end
          );
          
          const isPeakArrhythmia = peak.isArrhythmia || isInArrhythmiaZone;
          
          renderCtx.beginPath();
          renderCtx.arc(x, y, isPeakArrhythmia ? 7 : 5, 0, Math.PI * 2);
          renderCtx.fillStyle = isPeakArrhythmia ? '#DC2626' : '#0EA5E9';
          renderCtx.fill();
          
          if (isPeakArrhythmia) {
            renderCtx.beginPath();
            renderCtx.arc(x, y, 12, 0, Math.PI * 2);
            renderCtx.strokeStyle = '#FEF7CD';
            renderCtx.lineWidth = 3;
            renderCtx.stroke();
            
            renderCtx.font = 'bold 18px Inter';
            renderCtx.fillStyle = '#F97316';
            renderCtx.textAlign = 'center';
            renderCtx.fillText('ARRITMIA', x, y - 25);
            
            renderCtx.beginPath();
            renderCtx.arc(x, y, 20, 0, Math.PI * 2);
            const gradient = renderCtx.createRadialGradient(x, y, 5, x, y, 20);
            gradient.addColorStop(0, 'rgba(220, 38, 38, 0.8)');
            gradient.addColorStop(1, 'rgba(220, 38, 38, 0)');
            renderCtx.fillStyle = gradient;
            renderCtx.fill();
          }
          
          renderCtx.font = 'bold 16px Inter';
          renderCtx.fillStyle = '#000000';
          renderCtx.textAlign = 'center';
          renderCtx.fillText(Math.abs(peak.value / verticalScale).toFixed(2), x, y - 15);
          
          if (!peak.beepPlayed) {
            shouldBeep = true;
            peak.beepPlayed = true;
          }
        }
      });
    }
    
    if (USE_OFFSCREEN_CANVAS && offscreenCanvasRef.current) {
      const visibleCtx = canvas.getContext('2d', { alpha: false });
      if (visibleCtx) {
        visibleCtx.drawImage(offscreenCanvasRef.current, 0, 0);
      }
    }
    
    if (shouldBeep && isFingerDetected && 
        consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES) {
      const latestPeak = peaksRef.current.length > 0 ? peaksRef.current[peaksRef.current.length - 1] : null;
      const isPeakArrhythmia = latestPeak ? latestPeak.isArrhythmia : false;
      
      const isInArrhythmiaZone = latestPeak ? arrhythmiaWindows.some(window => 
        latestPeak.time >= window.start && latestPeak.time <= window.end
      ) : false;
      
      const finalIsArrhythmia = isPeakArrhythmia || isInArrhythmiaZone || isArrhythmia;
      
      console.log("PPGSignalMeter: Circle drawn, playing beep", {
        isPeakArrhythmia,
        isArrhythmia,
        isInArrhythmiaZone,
        finalIsArrhythmia,
        arrhythmiaStatus: arrhythmiaStatus || "N/A"
      });
      
      playBeep(1.0, finalIsArrhythmia);
    }
    
    lastRenderTimeRef.current = currentTime;
    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [
    value, quality, isFingerDetected, rawArrhythmiaData, arrhythmiaStatus, drawGrid, 
    detectPeaks, smoothValue, preserveResults, isArrhythmia, playBeep, IMMEDIATE_RENDERING, 
    FRAME_TIME, USE_OFFSCREEN_CANVAS, WINDOW_WIDTH_MS, verticalScale, REQUIRED_FINGER_FRAMES,
    drawArrhythmiaZones, arrhythmiaWindows, resultsVisible
  ]);

  useEffect(() => {
    renderSignal();
    
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [renderSignal]);

  useEffect(() => {
    if (signalData && signalData.length > 0) {
      const latestPoint = signalData[signalData.length - 1];
      if (latestPoint && dataBufferRef.current) {
        const pointWithPeakInfo: PPGDataPointExtended = {
            ...latestPoint,
            isPeak: latestPoint.isPeak || false,
            isArrhythmia: latestPoint.isArrhythmia || false
        };
        dataBufferRef.current.push(pointWithPeakInfo);
        setDisplayData(dataBufferRef.current.getPoints());

        if (currentBPM > 0 && pointWithPeakInfo.isPeak && pointWithPeakInfo.time > lastPeakTimestamp) {
            triggerBeep(pointWithPeakInfo.isArrhythmia ? 'arrhythmia' : 'normal');
            setLastPeakTimestamp(pointWithPeakInfo.time);
        }
      }
    } else if (!preserveResults) {
       if (dataBufferRef.current) {
         // dataBufferRef.current.clear();
       }
    }
  }, [signalData, preserveResults, triggerBeep, lastPeakTimestamp, currentBPM]);

  const handleReset = useCallback(() => {
    setShowArrhythmiaAlert(false);
    peaksRef.current = [];
    pendingBeepPeakIdRef.current = null;
    onReset();
  }, [onReset]);

  const displayQuality = getAverageQuality();
  const displayFingerDetected = consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES || preserveResults;

  return (
    <div className="fixed inset-0 bg-black/5 backdrop-blur-[1px] flex flex-col transform-gpu will-change-transform">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-[100vh] absolute inset-0 z-0 object-cover performance-boost"
        style={{
          transform: 'translate3d(0,0,0)',
          backfaceVisibility: 'hidden',
          contain: 'paint layout size',
          imageRendering: 'crisp-edges'
        }}
      />

      <div className="absolute top-0 left-0 right-0 p-1 flex justify-between items-center bg-transparent z-10 pt-3">
        <div className="flex items-center gap-2 ml-2">
          <span className="text-lg font-bold text-black/80">PPG</span>
          <div className="w-[180px]">
            <div className={`h-1 w-full rounded-full bg-gradient-to-r ${getQualityColor(quality)} transition-all duration-1000 ease-in-out`}>
              <div
                className="h-full rounded-full bg-white/20 animate-pulse transition-all duration-1000"
                style={{ width: `${resultsVisible ? displayQuality : 0}%` }}
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
});

PPGSignalMeter.displayName = 'PPGSignalMeter';

export default PPGSignalMeter;
