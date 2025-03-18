import React, { useEffect, useRef, useCallback, useState, memo } from 'react';
import { Fingerprint } from 'lucide-react';
import { CircularBuffer, PPGDataPoint } from '../utils/CircularBuffer';
import AppTitle from './AppTitle';
import { getSignalColor, isPointInArrhythmiaWindow } from '../utils/displayOptimizer';

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
  preserveResults = false,
  isArrhythmia = false
}: PPGSignalMeterProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataBufferRef = useRef<CircularBuffer<PPGDataPointExtended> | null>(null);
  const baselineRef = useRef<number | null>(null);
  const lastValueRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);
  const peaksRef = useRef<{time: number, value: number, isArrhythmia?: boolean, beepPlayed?: boolean}[]>([]);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qualityHistoryRef = useRef<number[]>([]);
  const consecutiveFingerFramesRef = useRef<number>(0);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const arrhythmiaTransitionRef = useRef<{
    active: boolean,
    startTime: number,
    endTime: number | null
  }>({ active: false, startTime: 0, endTime: null });
  
  const arrhythmiaSegmentsRef = useRef<Array<{startTime: number, endTime: number | null}>>([]);
  const lastArrhythmiaTimeRef = useRef<number>(0);

  // Audio context para beeps
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  
  // Bandera para controlar que no ocurran beeps duplicados
  const pendingBeepPeakIdRef = useRef<number | null>(null);
  
  // Nuevo: Valores para el cálculo de línea base adaptativa
  const baselineWindowRef = useRef<number[]>([]);
  const signalQualityFactorRef = useRef<number>(1.0);
  const lastSignalRef = useRef<number[]>([]);

  const CANVAS_CENTER_OFFSET = 60;
  const WINDOW_WIDTH_MS = 6500;
  const CANVAS_WIDTH = 1860;
  const CANVAS_HEIGHT = 800;
  const GRID_SIZE_X = 30;
  const GRID_SIZE_Y = 5;
  const verticalScale = 85.0;
  const SMOOTHING_FACTOR = 1.4;
  const TARGET_FPS = 60;
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 600;
  const PEAK_DETECTION_WINDOW = 6;
  const PEAK_THRESHOLD = 1.8;
  const MIN_PEAK_DISTANCE_MS = 250;
  const IMMEDIATE_RENDERING = true;
  const MAX_PEAKS_TO_DISPLAY = 20;
  const REQUIRED_FINGER_FRAMES = 3;
  const QUALITY_HISTORY_SIZE = 9;
  const USE_OFFSCREEN_CANVAS = false;
  const ARRHYTHMIA_COLOR = '#FF2E2E';
  const NORMAL_COLOR = '#0EA5E9';
  const ARRHYTHMIA_INDICATOR_SIZE = 8;
  const ARRHYTHMIA_PULSE_COLOR = '#FFDA00';
  const ARRHYTHMIA_DURATION_MS = 800;
  
  const LINE_WIDTH = 2.8;
  const MIN_SIGNAL_THRESHOLD = 0.008;
  const SIGNAL_GAP_TOLERANCE_MS = 120;
  const BASELINE_ADAPTATION_RATE = 0.985;

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
          
          if (audioContextRef.current.state === 'suspended' || audioContextRef.current.state === 'closed') {
            await audioContextRef.current.resume();
            
            if (audioContextRef.current.state !== 'running') {
              console.warn("PPGSignalMeter: Audio Context no está en estado 'running' después de resume");
            }
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
      
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ latencyHint: 'interactive' });
      }
      
      if (audioContextRef.current.state === 'suspended' || audioContextRef.current.state === 'closed') {
        await audioContextRef.current.resume();
        
        if (audioContextRef.current.state !== 'running') {
          console.warn("PPGSignalMeter: Audio Context no está en estado 'running' después de resume");
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
    
    if (!tempCanvasRef.current) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = CANVAS_WIDTH;
      tempCanvas.height = CANVAS_HEIGHT;
      tempCanvasRef.current = tempCanvas;
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
    
    const avgQuality = getAverageQuality();
    signalQualityFactorRef.current = Math.max(0.7, Math.min(1.5, avgQuality / 50));
    
    lastSignalRef.current.push(value);
    if (lastSignalRef.current.length > 20) {
      lastSignalRef.current.shift();
    }
  }, [quality, isFingerDetected]);

  useEffect(() => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = CANVAS_WIDTH;
    tempCanvas.height = CANVAS_HEIGHT;
    tempCanvasRef.current = tempCanvas;
    
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
    
    const maxJump = 0.35;
    const diff = Math.abs(currentValue - previousValue);
    
    if (diff > maxJump) {
      const interpolationFactor = 0.5;
      return previousValue + interpolationFactor * (currentValue - previousValue);
    }
    
    return previousValue + SMOOTHING_FACTOR * (currentValue - previousValue);
  }, []);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#E2DCFF');
    gradient.addColorStop(0.25, '#FFDECF');
    gradient.addColorStop(0.45, '#F1FBDF');
    gradient.addColorStop(0.55, '#F1EEE8');
    gradient.addColorStop(0.75, '#F5EED8');
    gradient.addColorStop(1, '#F5EED0');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.globalAlpha = 0.04;
    for (let i = 0; i < CANVAS_WIDTH; i += 20) {
      for (let j = 0; j < CANVAS_HEIGHT; j += 20) {
        const heightRatio = j / CANVAS_HEIGHT;
        const alphaModifier = 0.01 + (heightRatio * 0.03);
        
        ctx.fillStyle = j % 40 === 0 ? 
          `rgba(0,0,0,${0.2 + alphaModifier})` : 
          `rgba(255,255,255,${0.2 + alphaModifier})`;
        ctx.fillRect(i, j, 10, 10);
      }
    }
    ctx.globalAlpha = 1.0;
    
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.22)';
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
    
    const centerLineY = (CANVAS_HEIGHT / 2) - CANVAS_CENTER_OFFSET;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.moveTo(0, centerLineY);
    ctx.lineTo(CANVAS_WIDTH, centerLineY);
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  const isPointInArrhythmiaSegment = useCallback((pointTime: number, now: number): boolean => {
    const isNearArrhythmicPeak = peaksRef.current.some(peak => 
      peak.isArrhythmia && Math.abs(pointTime - peak.time) < 300
    );
    
    if (isNearArrhythmicPeak) return true;
    
    return arrhythmiaSegmentsRef.current.some(segment => {
      const endTime = segment.endTime || now;
      const segmentAge = now - endTime;
      return segmentAge < 3000 && pointTime >= segment.startTime && pointTime <= endTime;
    });
  }, []);

  const detectPeaks = useCallback((points: PPGDataPointExtended[], now: number) => {
    if (points.length < PEAK_DETECTION_WINDOW) return;
    
    const potentialPeaks: {index: number, value: number, time: number, isArrhythmia?: boolean}[] = [];
    
    const effectivePeakThreshold = PEAK_THRESHOLD * signalQualityFactorRef.current;
    
    for (let i = PEAK_DETECTION_WINDOW; i < points.length - PEAK_DETECTION_WINDOW; i++) {
      const currentPoint = points[i];
      
      if (currentPoint.value <= 0) continue;
      
      const minPeakDistance = 180;
      
      const recentlyProcessed = peaksRef.current.some(
        peak => Math.abs(peak.time - currentPoint.time) < minPeakDistance
      );
      
      if (recentlyProcessed) continue;
      
      let isPeak = true;
      
      for (let j = Math.max(0, i - PEAK_DETECTION_WINDOW); j < i; j++) {
        if (points[j].value >= currentPoint.value) {
          isPeak = false;
          break;
        }
      }
      
      if (isPeak) {
        for (let j = i + 1; j <= Math.min(points.length - 1, i + PEAK_DETECTION_WINDOW); j++) {
          if (points[j].value > currentPoint.value) {
            isPeak = false;
            break;
          }
        }
      }
      
      if (isPeak && Math.abs(currentPoint.value) > effectivePeakThreshold) {
        const isInArrhythmiaSegment = arrhythmiaSegmentsRef.current.some(segment => {
          const endTime = segment.endTime || now;
          return currentPoint.time >= segment.startTime && currentPoint.time <= endTime;
        });
        
        potentialPeaks.push({
          index: i,
          value: currentPoint.value,
          time: currentPoint.time,
          isArrhythmia: isInArrhythmiaSegment || isArrhythmia
        });
      }
    }
    
    for (const peak of potentialPeaks) {
      const tooClose = peaksRef.current.some(
        existingPeak => Math.abs(existingPeak.time - peak.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (!tooClose) {
        const peakId = Date.now() + Math.random();
        
        peaksRef.current.push({
          time: peak.time,
          value: peak.value,
          isArrhythmia: peak.isArrhythmia,
          beepPlayed: false
        });
        
        if (isFingerDetected && consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES) {
          pendingBeepPeakIdRef.current = peakId;
          
          console.log("PPGSignalMeter: Pico detectado, programado para beep:", {
            time: peak.time,
            value: peak.value,
            isArrhythmia: peak.isArrhythmia,
            peakId
          });
        }
      }
    }
    
    peaksRef.current.sort((a, b) => a.time - b.time);
    
    peaksRef.current = peaksRef.current
      .filter(peak => now - peak.time < WINDOW_WIDTH_MS)
      .slice(-MAX_PEAKS_TO_DISPLAY);
  }, [isFingerDetected, isArrhythmia]);

  const calculateAdaptiveBaseline = useCallback((value: number, isFingerDetected: boolean): number => {
    baselineWindowRef.current.push(value);
    if (baselineWindowRef.current.length > 30) {
      baselineWindowRef.current.shift();
    }
    
    if (baselineWindowRef.current.length < 5) {
      return value;
    }
    
    const sortedValues = [...baselineWindowRef.current].sort((a, b) => a - b);
    const trimmedValues = sortedValues.slice(
      Math.floor(sortedValues.length * 0.2),
      Math.ceil(sortedValues.length * 0.8)
    );
    
    const sum = trimmedValues.reduce((acc, val) => acc + val, 0);
    const mean = sum / trimmedValues.length;
    
    const adaptationRate = isFingerDetected ? BASELINE_ADAPTATION_RATE : 0.95;
    
    if (baselineRef.current === null) {
      return mean;
    }
    
    return baselineRef.current * adaptationRate + mean * (1 - adaptationRate);
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
    const renderCtx = tempCanvasRef.current ? 
      tempCanvasRef.current.getContext('2d', { alpha: false }) : 
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
      if (tempCanvasRef.current) {
        const visibleCtx = canvas.getContext('2d', { alpha: false });
        if (visibleCtx) {
          visibleCtx.drawImage(tempCanvasRef.current, 0, 0);
        }
      }
      
      lastRenderTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const adaptiveBaseline = calculateAdaptiveBaseline(value, isFingerDetected);
    baselineRef.current = adaptiveBaseline;
    
    let smoothedValue = value;
    if (lastValueRef.current !== null) {
      smoothedValue = smoothValue(value, lastValueRef.current);
    }
    lastValueRef.current = smoothedValue;
    
    const normalizedValue = (baselineRef.current || 0) - smoothedValue;
    const effectiveVerticalScale = verticalScale * signalQualityFactorRef.current;
    const scaledValue = normalizedValue * effectiveVerticalScale;
    
    const pointIsArrhythmia = isArrhythmia;
    
    const dataPoint: PPGDataPointExtended = {
      time: now,
      value: scaledValue,
      isArrhythmia: pointIsArrhythmia
    };
    
    if (Math.abs(scaledValue) > MIN_SIGNAL_THRESHOLD) {
      dataBufferRef.current.push(dataPoint);
    } else if (dataBufferRef.current.getPoints().length > 0) {
      const lastPoint = dataBufferRef.current.getPoints()[dataBufferRef.current.getPoints().length - 1];
      if (lastPoint && now - lastPoint.time < SIGNAL_GAP_TOLERANCE_MS) {
        const continuityPoint: PPGDataPointExtended = {
          time: now,
          value: lastPoint.value * 0.95,
          isArrhythmia: pointIsArrhythmia
        };
        dataBufferRef.current.push(continuityPoint);
      } else {
        dataBufferRef.current.push(dataPoint);
      }
    } else {
      dataBufferRef.current.push(dataPoint);
    }
    
    const points = dataBufferRef.current.getPoints();
    detectPeaks(points, now);
    
    let shouldBeep = false;
    
    if (points.length > 1) {
      let segmentPoints: {x: number, y: number, isArrhythmia: boolean}[] = [];
      let currentSegmentIsArrhythmia = false;
      
      const segments: {points: {x: number, y: number, isArrhythmia: boolean}[], isArrhythmia: boolean}[] = [];
      let currentSegment: {x: number, y: number, isArrhythmia: boolean}[] = [];
      let currentIsArrhythmia = !!points[0].isArrhythmia;
      
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        
        point.isArrhythmia = point.isArrhythmia || isPointInArrhythmiaSegment(point.time, now);
        
        const x = canvas.width - ((now - point.time) * canvas.width / WINDOW_WIDTH_MS);
        const y = (canvas.height / 2) - CANVAS_CENTER_OFFSET - point.value;
        
        if (i > 0) {
          const prevPoint = points[i-1];
          const timeDiff = point.time - prevPoint.time;
          const isGap = timeDiff > SIGNAL_GAP_TOLERANCE_MS;
          const typeChanged = currentIsArrhythmia !== !!point.isArrhythmia;
          
          if (isGap || typeChanged) {
            if (currentSegment.length > 0) {
              segments.push({
                points: [...currentSegment],
                isArrhythmia: currentIsArrhythmia
              });
              currentSegment = [];
            }
            currentIsArrhythmia = !!point.isArrhythmia;
          }
        }
        
        currentSegment.push({
          x, y, isArrhythmia: !!point.isArrhythmia
        });
      }
      
      if (currentSegment.length > 0) {
        segments.push({
          points: currentSegment,
          isArrhythmia: currentIsArrhythmia
        });
      }
      
      segments.forEach(segment => {
        if (segment.points.length < 2) return;
        
        renderCtx.beginPath();
        renderCtx.strokeStyle = getSignalColor(segment.isArrhythmia);
        renderCtx.lineWidth = LINE_WIDTH;
        renderCtx.lineJoin = 'round';
        renderCtx.lineCap = 'round';
        
        renderCtx.shadowBlur = 1.5;
        renderCtx.shadowColor = getSignalColor(segment.isArrhythmia);
        
        for (let j = 0; j < segment.points.length; j++) {
          const point = segment.points[j];
          if (j === 0) {
            renderCtx.moveTo(point.x, point.y);
          } else {
            if (j < segment.points.length - 1) {
              const nextPoint = segment.points[j+1];
              const xc = (point.x + nextPoint.x) / 2;
              const yc = (point.y + nextPoint.y) / 2;
              renderCtx.quadraticCurveTo(point.x, point.y, xc, yc);
            } else {
              renderCtx.lineTo(point.x, point.y);
            }
          }
        }
        
        renderCtx.stroke();
        renderCtx.shadowBlur = 0;
      });
      
      if (peaksRef.current.length > 0) {
        peaksRef.current.forEach(peak => {
          const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
          const y = (canvas.height / 2) - CANVAS_CENTER_OFFSET - peak.value;
          
          if (x >= 0 && x <= canvas.width) {
            const peakColor = getSignalColor(!!peak.isArrhythmia);
            
            if (peak.isArrhythmia) {
              renderCtx.fillStyle = ARRHYTHMIA_PULSE_COLOR;
              renderCtx.beginPath();
              
              const pulsePhase = (now % 1500) / 1500;
              const pulseScale = 1 + 0.15 * Math.sin(pulsePhase * Math.PI * 2);
              const pulseSize = ARRHYTHMIA_INDICATOR_SIZE * pulseScale;
              
              renderCtx.arc(x, y, pulseSize, 0, Math.PI * 2);
              renderCtx.fill();
              
              renderCtx.fillStyle = peakColor;
              renderCtx.beginPath();
              renderCtx.arc(x, y, ARRHYTHMIA_INDICATOR_SIZE * 0.6, 0, Math.PI * 2);
              renderCtx.fill();
              
              if (!peak.beepPlayed) {
                shouldBeep = true;
                peak.beepPlayed = true;
              }
            } else {
              renderCtx.shadowBlur = 3;
              renderCtx.shadowColor = peakColor;
              
              renderCtx.fillStyle = peakColor;
              renderCtx.beginPath();
              renderCtx.arc(x, y, 5, 0, Math.PI * 2);
              renderCtx.fill();
              
              renderCtx.shadowBlur = 0;
              
              if (!peak.beepPlayed) {
                shouldBeep = true;
                peak.beepPlayed = true;
              }
            }
            
            renderCtx.font = 'bold 16px Inter';
            renderCtx.fillStyle = peak.isArrhythmia ? '#ea384c' : '#000000';
            renderCtx.textAlign = 'center';
            renderCtx.fillText(Math.abs(peak.value / effectiveVerticalScale).toFixed(2), x, y - 15);
          }
        });
      }
    }
    
    if (tempCanvasRef.current) {
      const visibleCtx = canvas.getContext('2d', { alpha: false });
      if (visibleCtx) {
        visibleCtx.drawImage(tempCanvasRef.current, 0, 0);
      }
    }
    
    if (shouldBeep && pendingBeepPeakIdRef.current && isFingerDetected && 
        consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES) {
      console.log("PPGSignalMeter: Círculo dibujado, reproduciendo beep (un beep por latido)");
      playBeep(1.0);
    }
    
    lastRenderTimeRef.current = currentTime;
    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [value, quality, isFingerDetected, drawGrid, detectPeaks, smoothValue, preserveResults, isArrhythmia, isPointInArrhythmiaSegment, playBeep, calculateAdaptiveBaseline]);

  useEffect(() => {
    renderSignal();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderSignal]);

  const handleReset = useCallback(() => {
    peaksRef.current = [];
    arrhythmiaTransitionRef.current = { active: false, startTime: 0, endTime: null };
    arrhythmiaSegmentsRef.current = [];
    pendingBeepPeakIdRef.current = null;
    baselineWindowRef.current = [];
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
        className="w-full h-full absolute inset-0 z-0 object-cover performance-boost"
        style={{
          transform: 'translate3d(0,0,0)',
          backfaceVisibility: 'hidden',
          contain: 'paint layout size',
          imageRendering: 'crisp-edges'
        }}
      />

      <div className="absolute top-0 left-0 right-0 p-1 flex justify-between items-center bg-transparent z-10 pt-1">
        <div className="flex items-center gap-1 ml-2 mt-0" style={{transform: 'translateY(-2mm)'}}>
          <div className="w-[120px]">
            <div className={`h-1 w-full rounded-full bg-gradient-to-r ${getQualityColor(quality)} transition-all duration-1000 ease-in-out`}>
              <div
                className="h-full rounded-full bg-white/20 animate-pulse transition-all duration-1000"
                style={{ width: `${displayFingerDetected ? displayQuality : 0}%` }}
              />
            </div>
            <span className="text-[7px] text-center mt-0.5 font-medium transition-colors duration-700 block" 
                  style={{ color: displayQuality > 60 ? '#0EA5E9' : '#F59E0B' }}>
              {getQualityText(quality)}
            </span>
          </div>
          <div style={{ marginLeft: '2mm' }}>
            <AppTitle />
          </div>
        </div>

        <div className="flex flex-col items-center">
          <Fingerprint
            className={`h-7 w-7 transition-colors duration-300 ${
              !displayFingerDetected ? 'text-gray-400' :
              displayQuality > 65 ? 'text-green-500' :
              displayQuality > 40 ? 'text-yellow-500' :
              'text-red-500'
            }`}
            strokeWidth={1.5}
          />
          <span className="text-[7px] text-center font-medium text-black/80">
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
