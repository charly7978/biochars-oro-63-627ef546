import React, { useEffect, useRef, useCallback, useState, memo } from 'react';
import { Fingerprint, AlertCircle, Clock } from 'lucide-react';
import { CircularBuffer, PPGDataPoint } from '../utils/CircularBuffer';
import AppTitle from './AppTitle';
import { 
  generateTimeGridMarkers, 
  drawPPGReference, 
  isPointInArrhythmiaWindow,
  getSignalColor
} from '../utils/displayOptimizer';
import { 
  findPeaksAndValleys, 
  calculateAmplitude,
  detectArrhythmiaPattern
} from '../modules/vital-signs/utils/peak-detection-utils';

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
  vitalSigns?: {
    heartRate: number;
    spo2: number;
    pressure: string;
    arrhythmiaCount: string | number;
  };
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
  isArrhythmia = false,
  vitalSigns
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

  const WINDOW_WIDTH_MS = 5500;
  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 900;
  const GRID_SIZE_X = 25;
  const GRID_SIZE_Y = 5;
  const verticalScale = 55.0;
  const SMOOTHING_FACTOR = 1.5;
  const TARGET_FPS = 60;
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 600;
  const PEAK_DETECTION_WINDOW = 8;
  const PEAK_THRESHOLD = 3;
  const MIN_PEAK_DISTANCE_MS = 250;
  const IMMEDIATE_RENDERING = true;
  const MAX_PEAKS_TO_DISPLAY = 25;
  const QUALITY_HISTORY_SIZE = 9;
  const REQUIRED_FINGER_FRAMES = 3;
  const USE_OFFSCREEN_CANVAS = true;

  const BEEP_PRIMARY_FREQUENCY = 880;
  const BEEP_SECONDARY_FREQUENCY = 440;
  const BEEP_DURATION = 80;
  const BEEP_VOLUME = 0.9;
  const MIN_BEEP_INTERVAL_MS = 350;

  useEffect(() => {
    const initAudio = async () => {
      try {
        if (!audioContextRef.current && typeof AudioContext !== 'undefined') {
          console.log("PPGSignalMeter: Inicializando Audio Context");
          audioContextRef.current = new AudioContext({ latencyHint: 'interactive' });
          
          if (audioContextRef.current.state !== 'running') {
            await audioContextRef.current.resume();
          }
          
          await playBeep(0.01);
        }
      } catch (err) {
        console.error("PPGSignalMeter: Error inicializando audio context:", err);
      }
    };
    
    initAudio();
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(err => {
          console.error("PPGSignalMeter: Error cerrando audio context:", err);
        });
        audioContextRef.current = null;
      }
    };
  }, []);

  const playBeep = useCallback(async (volume = BEEP_VOLUME) => {
    try {
      const now = Date.now();
      if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS) {
        console.log("PPGSignalMeter: Beep bloqueado por intervalo mínimo", {
          timeSinceLastBeep: now - lastBeepTimeRef.current,
          minInterval: MIN_BEEP_INTERVAL_MS
        });
        return false;
      }
      
      if (!audioContextRef.current || audioContextRef.current.state !== 'running') {
        if (audioContextRef.current) {
          await audioContextRef.current.resume();
        } else {
          audioContextRef.current = new AudioContext({ latencyHint: 'interactive' });
        }
        
        if (audioContextRef.current.state !== 'running') {
          console.warn("PPGSignalMeter: No se pudo activar el contexto de audio");
          return false;
        }
      }
      
      console.log("PPGSignalMeter: Reproduciendo beep para círculo dibujado, volumen:", volume);
      
      const primaryOscillator = audioContextRef.current.createOscillator();
      const primaryGain = audioContextRef.current.createGain();
      
      const secondaryOscillator = audioContextRef.current.createOscillator();
      const secondaryGain = audioContextRef.current.createGain();
      
      primaryOscillator.type = "sine";
      primaryOscillator.frequency.setValueAtTime(
        BEEP_PRIMARY_FREQUENCY,
        audioContextRef.current.currentTime
      );
      
      secondaryOscillator.type = "sine";
      secondaryOscillator.frequency.setValueAtTime(
        BEEP_SECONDARY_FREQUENCY,
        audioContextRef.current.currentTime
      );
      
      const adjustedVolume = Math.min(volume * 2.0, 1.0);
      
      primaryGain.gain.setValueAtTime(0, audioContextRef.current.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        adjustedVolume,
        audioContextRef.current.currentTime + 0.0005
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        audioContextRef.current.currentTime + BEEP_DURATION / 1000
      );
      
      secondaryGain.gain.setValueAtTime(0, audioContextRef.current.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(
        adjustedVolume * 0.8,
        audioContextRef.current.currentTime + 0.0005
      );
      secondaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        audioContextRef.current.currentTime + BEEP_DURATION / 1000
      );
      
      primaryOscillator.connect(primaryGain);
      secondaryOscillator.connect(secondaryGain);
      primaryGain.connect(audioContextRef.current.destination);
      secondaryGain.connect(audioContextRef.current.destination);
      
      primaryOscillator.start(audioContextRef.current.currentTime);
      secondaryOscillator.start(audioContextRef.current.currentTime);
      primaryOscillator.stop(audioContextRef.current.currentTime + BEEP_DURATION / 1000 + 0.02);
      secondaryOscillator.stop(audioContextRef.current.currentTime + BEEP_DURATION / 1000 + 0.02);
      
      lastBeepTimeRef.current = now;
      pendingBeepPeakIdRef.current = null;
      
      return true;
    } catch (err) {
      console.error("PPGSignalMeter: Error reproduciendo beep:", err);
      return false;
    }
  }, []);

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
  }, [preserveResults, isFingerDetected]);

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

  const smoothValue = useCallback((currentValue: number, previousValue: number | null): number => {
    if (previousValue === null) return currentValue;
    return previousValue + SMOOTHING_FACTOR * (currentValue - previousValue);
  }, []);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#E8F4FF');
    gradient.addColorStop(0.3, '#F9FBFF');
    gradient.addColorStop(0.7, '#F9FBFF');
    gradient.addColorStop(1, '#F0F8FF');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.globalAlpha = 0.02;
    for (let i = 0; i < CANVAS_WIDTH; i += 20) {
      for (let j = 0; j < CANVAS_HEIGHT; j += 20) {
        ctx.fillStyle = j % 40 === 0 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';
        ctx.fillRect(i, j, 10, 10);
      }
    }
    ctx.globalAlpha = 1.0;
    
    generateTimeGridMarkers(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, 250, 0.2);
    
    drawPPGReference(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    if (arrhythmiaStatus) {
      const [status, count] = arrhythmiaStatus.split('|');
      
      if (status.includes("ARRITMIA")) {
        let message = "";
        let bgColor = "rgba(239, 68, 68, 0.1)";
        let textColor = "#ef4444";
        
        if (count === "1" && !showArrhythmiaAlert) {
          message = '¡PRIMERA ARRITMIA DETECTADA!';
          setShowArrhythmiaAlert(true);
        } else if (Number(count) > 1) {
          message = `Arritmias detectadas: ${count}`;
        }
        
        if (message) {
          const textWidth = ctx.measureText(message).width + 30;
          
          ctx.fillStyle = bgColor;
          ctx.fillRect(30, 70, textWidth, 40);
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
          ctx.lineWidth = 2;
          ctx.strokeRect(30, 70, textWidth, 40);
          
          ctx.fillStyle = textColor;
          ctx.font = 'bold 24px "Inter", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(message, 45, 95);
        }
      }
    }
  }, [arrhythmiaStatus, showArrhythmiaAlert]);

  const detectPeaks = useCallback((points: PPGDataPointExtended[], now: number) => {
    if (points.length < PEAK_DETECTION_WINDOW) return;
    
    const values = points.map(p => p.value);
    
    const { peakIndices, valleyIndices } = findPeaksAndValleys(values.slice(-100));
    
    const offset = Math.max(0, values.length - 100);
    
    const arrhythmiaResult = detectArrhythmiaPattern(
      peakIndices.map(idx => idx + offset), 
      values,
      30
    );
    
    const lastPeaks = peakIndices.map(idx => {
      const actualIdx = idx + offset;
      if (actualIdx >= 0 && actualIdx < points.length) {
        const point = points[actualIdx];
        
        const isInArrhythmiaSegment = arrhythmiaResult.segments.some(seg => 
          actualIdx >= seg.start && actualIdx <= seg.end
        );
        
        const recentlyProcessed = peaksRef.current.some(
          peak => Math.abs(peak.time - point.time) < MIN_PEAK_DISTANCE_MS
        );
        
        if (!recentlyProcessed) {
          const newPeak = {
            time: point.time,
            value: point.value,
            isArrhythmia: isInArrhythmiaSegment || point.isArrhythmia || false,
            beepPlayed: false
          };
          
          peaksRef.current.push(newPeak);
        }
      }
    });
    
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
    if (rawArrhythmiaData && 
        arrhythmiaStatus?.includes("ARRITMIA") && 
        now - rawArrhythmiaData.timestamp < 1000) {
      currentIsArrhythmia = true;
      lastArrhythmiaTime.current = now;
    } else if (isArrhythmia) {
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
      const arrhythmiaWindows = arrhythmiaSegmentsRef.current
        .filter(seg => seg.endTime !== null)
        .map(seg => ({ start: seg.startTime, end: seg.endTime as number }));
      
      if (now - lastArrhythmiaTime.current < 2000) {
        const currentSegment = arrhythmiaSegmentsRef.current.find(seg => seg.endTime === null);
        if (currentSegment) {
          currentSegment.endTime = now;
        } else {
          arrhythmiaSegmentsRef.current.push({
            startTime: Math.max(now - 1000, lastArrhythmiaTime.current),
            endTime: null
          });
        }
      }
      
      renderCtx.lineWidth = 2.5;
      renderCtx.lineJoin = 'round';
      renderCtx.lineCap = 'round';
      
      let currentPath: { x: number, y: number, isArrhythmia: boolean }[] = [];
      let pathStarted = false;
      let lastPoint = null;
      
      const drawingPoints = points.map(point => {
        const x = canvas.width - ((now - point.time) * canvas.width / WINDOW_WIDTH_MS);
        const y = canvas.height / 2 - point.value;
        const isPointArrhythmia = point.isArrhythmia || 
          isPointInArrhythmiaWindow(point.time, arrhythmiaWindows, now);
        
        return { x, y, isArrhythmia: isPointArrhythmia };
      }).filter(point => point.x >= 0 && point.x <= canvas.width);
      
      for (let i = 0; i < drawingPoints.length; i++) {
        const point = drawingPoints[i];
        
        if (i === 0 || lastPoint?.isArrhythmia !== point.isArrhythmia) {
          if (currentPath.length > 0) {
            renderCtx.beginPath();
            renderCtx.strokeStyle = getSignalColor(lastPoint?.isArrhythmia || false);
            
            renderCtx.moveTo(currentPath[0].x, currentPath[0].y);
            for (let j = 1; j < currentPath.length; j++) {
              renderCtx.lineTo(currentPath[j].x, currentPath[j].y);
            }
            
            renderCtx.stroke();
          }
          
          currentPath = [point];
          lastPoint = point;
        } else {
          currentPath.push(point);
          lastPoint = point;
        }
      }
      
      if (currentPath.length > 0) {
        renderCtx.beginPath();
        renderCtx.strokeStyle = getSignalColor(lastPoint?.isArrhythmia || false);
        
        renderCtx.moveTo(currentPath[0].x, currentPath[0].y);
        for (let j = 1; j < currentPath.length; j++) {
          renderCtx.lineTo(currentPath[j].x, currentPath[j].y);
        }
        
        renderCtx.stroke();
      }
      
      peaksRef.current.forEach(peak => {
        const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
        const y = canvas.height / 2 - peak.value;
        
        if (x >= 0 && x <= canvas.width) {
          renderCtx.beginPath();
          renderCtx.arc(x, y, 6, 0, Math.PI * 2);
          renderCtx.fillStyle = peak.isArrhythmia ? '#DC2626' : '#0EA5E9';
          renderCtx.fill();
          
          if (now - peak.time < 500) {
            renderCtx.beginPath();
            renderCtx.arc(x, y, 6 + (now - peak.time) / 50, 0, Math.PI * 2);
            renderCtx.strokeStyle = peak.isArrhythmia ? 'rgba(220, 38, 38, 0.3)' : 'rgba(14, 165, 233, 0.3)';
            renderCtx.lineWidth = 2;
            renderCtx.stroke();
          }
          
          if (peak.isArrhythmia) {
            renderCtx.beginPath();
            renderCtx.arc(x, y, 12, 0, Math.PI * 2);
            renderCtx.strokeStyle = '#FEF7CD';
            renderCtx.lineWidth = 3;
            renderCtx.stroke();
            
            renderCtx.font = 'bold 12px "Inter", sans-serif';
            renderCtx.fillStyle = '#F97316';
            renderCtx.textAlign = 'center';
            renderCtx.fillText('ARRITMIA', x, y - 20);
          }
          
          renderCtx.font = '12px "Inter", sans-serif';
          renderCtx.fillStyle = peak.isArrhythmia ? '#DC2626' : '#0EA5E9';
          renderCtx.textAlign = 'center';
          renderCtx.fillText(Math.abs(peak.value / verticalScale).toFixed(2), x, y - 15);
          
          if (!peak.beepPlayed) {
            shouldBeep = true;
            peak.beepPlayed = true;
          }
        }
      });
      
      if (isFingerDetected && vitalSigns && vitalSigns.heartRate > 0) {
        renderCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        renderCtx.fillRect(20, 20, 140, 75);
        renderCtx.strokeStyle = 'rgba(14, 165, 233, 0.5)';
        renderCtx.lineWidth = 1;
        renderCtx.strokeRect(20, 20, 140, 75);
        
        renderCtx.font = 'bold 16px "Inter", sans-serif';
        renderCtx.fillStyle = '#0f172a';
        renderCtx.textAlign = 'left';
        renderCtx.fillText('TIEMPO REAL', 30, 40);
        
        renderCtx.font = '14px "Inter", sans-serif';
        renderCtx.fillStyle = '#334155';
        renderCtx.fillText(`FC: ${vitalSigns.heartRate} BPM`, 30, 60);
        renderCtx.fillText(`SpO2: ${vitalSigns.spo2}%`, 30, 80);
      }
    }
    
    if (USE_OFFSCREEN_CANVAS && offscreenCanvasRef.current) {
      const visibleCtx = canvas.getContext('2d', { alpha: false });
      if (visibleCtx) {
        visibleCtx.drawImage(offscreenCanvasRef.current, 0, 0);
      }
    }
    
    if (shouldBeep && isFingerDetected && 
        consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES) {
      console.log("PPGSignalMeter: Círculo dibujado, reproduciendo beep (un beep por latido)");
      playBeep(1.0);
    }
    
    lastRenderTimeRef.current = currentTime;
    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [value, quality, isFingerDetected, rawArrhythmiaData, arrhythmiaStatus, drawGrid, detectPeaks, smoothValue, preserveResults, isArrhythmia, playBeep, vitalSigns]);

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
    arrhythmiaSegmentsRef.current = [];
    pendingBeepPeakIdRef.current = null;
    onReset();
  }, [onReset]);

  const displayQuality = getAverageQuality();
  const displayFingerDetected = consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES;

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

      {vitalSigns && (
        <div className="absolute top-16 right-4 bg-white/30 backdrop-blur-md p-3 rounded-lg shadow-lg z-10">
          <div className="text-sm font-bold mb-1 text-slate-800">Signos Vitales</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1"><span className="text-slate-600">FC:</span> <span className="font-medium text-slate-800">{vitalSigns.heartRate} BPM</span></div>
            <div className="flex items-center gap-1"><span className="text-slate-600">SpO2:</span> <span className="font-medium text-slate-800">{vitalSigns.spo2}%</span></div>
            <div className="flex items-center gap-1"><span className="text-slate-600">Presión:</span> <span className="font-medium text-slate-800">{vitalSigns.pressure}</span></div>
            <div className="flex items-center gap-1"><span className="text-slate-600">Arritmias:</span> <span className="font-medium text-slate-800">{vitalSigns.arrhythmiaCount}</span></div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 h-[60px] grid grid-cols-2 bg-transparent z-10">
        <button 
          onClick={onStartMeasurement}
          className="bg-transparent text-black/80 hover:bg-white/5 active:bg-white/10 transition-colors duration-200 text-sm font-semibold flex items-center justify-center"
        >
          <span className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"></path>
              <path d="M12 5v14"></path>
            </svg>
            INICIAR
          </span>
        </button>
        <button 
          onClick={handleReset}
          className="bg-transparent text-black/80 hover:bg-white/5 active:bg-white/10 transition-colors duration-200 text-sm font-semibold flex items-center justify-center"
        >
          <span className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
            </svg>
            RESET
          </span>
        </button>
      </div>
    </div>
  );
});

PPGSignalMeter.displayName = 'PPGSignalMeter';

export default PPGSignalMeter;
