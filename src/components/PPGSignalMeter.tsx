import React, { useEffect, useRef, useCallback, useState, memo } from 'react';
import { Fingerprint } from 'lucide-react';
import { CircularBuffer, PPGDataPoint } from '../utils/CircularBuffer';
import AppTitle from './AppTitle';
import { getSignalColor, isPointInArrhythmiaWindow } from '../utils/displayOptimizer';
import { fingerDetectionService } from '../core/FingerDetectionService';

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
  isMonitoring?: boolean;
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
  isArrhythmia = false,
  isMonitoring = false
}: PPGSignalMeterProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataBufferRef = useRef<CircularBuffer<PPGDataPointExtended> | null>(null);
  const baselineRef = useRef<number | null>(null);
  const lastValueRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);
  const peaksRef = useRef<{time: number, value: number, isArrhythmia?: boolean}[]>([]);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qualityHistoryRef = useRef<number[]>([]);
  const consecutiveFingerFramesRef = useRef<number>(0);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const arrhythmiaTransitionRef = useRef<{
    active: boolean,
    startTime: number,
    endTime: number | null
  }>({ active: false, startTime: 0, endTime: null });
  
  const arrhythmiaSegmentsRef = useRef<Array<{startTime: number, endTime: number | null}>>([]);
  const lastArrhythmiaTimeRef = useRef<number>(0);
  
  const signalAmplitudeHistoryRef = useRef<number[]>([]);
  const fingerprintConfidenceRef = useRef<number>(0);
  const detectionStabilityCounterRef = useRef<number>(0);
  const lastDetectionStateRef = useRef<boolean>(false);
  const noiseBufferRef = useRef<number[]>([]);
  const peakVarianceRef = useRef<number[]>([]);
  const lastStableDetectionTimeRef = useRef<number>(0);
  const derivativeBufferRef = useRef<number[]>([]);
  
  const rrIntervalsRef = useRef<number[]>([]);
  const lastPeakTimeRef = useRef<number | null>(null);
  const arrhythmiaCountRef = useRef<number>(0);
  const arrhythmiaDetectedRef = useRef<boolean>(false);
  const consecutiveAnomaliesRef = useRef<number>(0);

  const CANVAS_CENTER_OFFSET = 60;
  const WINDOW_WIDTH_MS = 5000;
  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 720;
  const GRID_SIZE_X = 30;
  const GRID_SIZE_Y = 5;
  const verticalScale = 65.0;
  const SMOOTHING_FACTOR = 1.6;
  const TARGET_FPS = 180;
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 600;
  const PEAK_DETECTION_WINDOW = 6;
  const PEAK_THRESHOLD = 2.0;
  const MIN_PEAK_DISTANCE_MS = 200;
  const IMMEDIATE_RENDERING = true;
  const MAX_PEAKS_TO_DISPLAY = 20;
  
  const REQUIRED_FINGER_FRAMES = 12;
  const QUALITY_HISTORY_SIZE = 20;
  const AMPLITUDE_HISTORY_SIZE = 20;
  const MIN_AMPLITUDE_THRESHOLD = 1.5;
  const REQUIRED_STABILITY_FRAMES = 5;
  const QUALITY_DECAY_RATE = 0.75;
  const NOISE_BUFFER_SIZE = 20;
  const MAX_NOISE_RATIO = 0.2;
  const MIN_PEAK_VARIANCE = 1.2;
  const STABILITY_TIMEOUT_MS = 4000;
  const MIN_DERIVATIVE_THRESHOLD = 0.5;

  const MIN_TIME_BETWEEN_ARRHYTHMIAS = 3500;
  const MAX_ARRHYTHMIAS_PER_SESSION = 40;
  const ARRHYTHMIA_THRESHOLD = 0.25;
  const CONSECUTIVE_ANOMALIES_THRESHOLD = 6;
  const MIN_RR_INTERVALS = 16;

  const USE_OFFSCREEN_CANVAS = true;
  const ARRHYTHMIA_COLOR = '#FF2E2E';
  const NORMAL_COLOR = '#0EA5E9';
  const ARRHYTHMIA_INDICATOR_SIZE = 8;
  const ARRHYTHMIA_PULSE_COLOR = '#FFDA00';
  const ARRHYTHMIA_DURATION_MS = 800;

  const beepRequesterRef = useRef<((time: number) => void) | null>(null);
  const lastBeepRequestTimeRef = useRef<number>(0);

  const requestBeepForPeak = useCallback((timestamp: number) => {
    const now = Date.now();
    if (now - lastBeepRequestTimeRef.current < 250) return;
    
    if (beepRequesterRef.current) {
      beepRequesterRef.current(timestamp);
      lastBeepRequestTimeRef.current = now;
    }
  }, []);

  useEffect(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer<PPGDataPointExtended>(BUFFER_SIZE);
    }
    if (!isMonitoring || !isFingerDetected) {
      if (dataBufferRef.current) {
        dataBufferRef.current.clear();
      }
      peaksRef.current = [];
      baselineRef.current = null;
      lastValueRef.current = null;
    }
  }, [preserveResults, isFingerDetected, isMonitoring]);

  const calculateDerivative = useCallback((value: number) => {
    if (lastValueRef.current === null) return 0;
    return value - lastValueRef.current;
  }, []);

  useEffect(() => {
    if (!isMonitoring) return;

    if (!derivativeBufferRef.current) {
      derivativeBufferRef.current = [];
    }

    if (lastValueRef.current !== null) {
      const derivative = Math.abs(calculateDerivative(value));
      derivativeBufferRef.current.push(derivative);
      if (derivativeBufferRef.current.length > NOISE_BUFFER_SIZE) {
        derivativeBufferRef.current.shift();
      }
    }
    
    if (isFingerDetected && quality > 5) {
      qualityHistoryRef.current.push(quality);
    } else {
      qualityHistoryRef.current.push(Math.max(0, quality * QUALITY_DECAY_RATE));
    }
    
    if (qualityHistoryRef.current.length > QUALITY_HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    if (lastValueRef.current !== null && baselineRef.current !== null) {
      const amplitude = Math.abs(lastValueRef.current - baselineRef.current);
      signalAmplitudeHistoryRef.current.push(amplitude);
      if (signalAmplitudeHistoryRef.current.length > AMPLITUDE_HISTORY_SIZE) {
        signalAmplitudeHistoryRef.current.shift();
      }
      
      noiseBufferRef.current.push(value);
      if (noiseBufferRef.current.length > NOISE_BUFFER_SIZE) {
        noiseBufferRef.current.shift();
      }
    }
    
    const now = Date.now();
    
    if (now - lastStableDetectionTimeRef.current > STABILITY_TIMEOUT_MS) {
      detectionStabilityCounterRef.current = 0;
      consecutiveFingerFramesRef.current = 0;
    }
    
    if (isFingerDetected) {
      if (quality > 55) {
        consecutiveFingerFramesRef.current++;
        detectionStabilityCounterRef.current = Math.min(10, detectionStabilityCounterRef.current + 0.5);
        
        if (detectionStabilityCounterRef.current >= REQUIRED_STABILITY_FRAMES) {
          lastStableDetectionTimeRef.current = now;
        }
      } else {
        consecutiveFingerFramesRef.current = Math.max(0, consecutiveFingerFramesRef.current - 0.3);
        detectionStabilityCounterRef.current = Math.max(0, detectionStabilityCounterRef.current - 0.7);
      }
    } else {
      consecutiveFingerFramesRef.current = Math.max(0, consecutiveFingerFramesRef.current - 1.5);
      detectionStabilityCounterRef.current = Math.max(0, detectionStabilityCounterRef.current - 1.2);
    }
    
    const highQualityFrames = qualityHistoryRef.current.filter(q => q > 55);
    const detectionRatio = highQualityFrames.length / Math.max(1, qualityHistoryRef.current.length);
    fingerprintConfidenceRef.current = Math.min(1, detectionRatio * 1.3);
    
    lastDetectionStateRef.current = isFingerDetected;
    
    try {
      if (fingerDetectionService && typeof fingerDetectionService.processSignal === 'function') {
        const signal = {
          fingerDetected: isFingerDetected,
          quality: quality,
          filteredValue: value,
          rawValue: value
        };
        fingerDetectionService.processSignal(signal);
      }
    } catch (err) {
      console.error("Error updating finger detection service:", err);
    }
  }, [quality, isFingerDetected, value, calculateDerivative, isMonitoring]);

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

  useEffect(() => {
    if (!isMonitoring) return;
    
    const now = Date.now();
    
    if (isArrhythmia && !arrhythmiaTransitionRef.current.active) {
      arrhythmiaTransitionRef.current = { 
        active: true, 
        startTime: now, 
        endTime: null 
      };
      
      arrhythmiaSegmentsRef.current.push({
        startTime: now,
        endTime: null
      });
      
      lastArrhythmiaTimeRef.current = now;
      
      console.log('PPGSignalMeter: Nueva arritmia detectada en', new Date(now).toISOString());
    } 
    else if (!isArrhythmia && arrhythmiaTransitionRef.current.active) {
      arrhythmiaTransitionRef.current = {
        ...arrhythmiaTransitionRef.current,
        active: false,
        endTime: now
      };
      
      if (arrhythmiaSegmentsRef.current.length > 0) {
        const lastIndex = arrhythmiaSegmentsRef.current.length - 1;
        if (arrhythmiaSegmentsRef.current[lastIndex].endTime === null) {
          arrhythmiaSegmentsRef.current[lastIndex].endTime = now;
        }
      }
      
      console.log('PPGSignalMeter: Fin de arritmia en', new Date(now).toISOString());
    }
    
    arrhythmiaSegmentsRef.current = arrhythmiaSegmentsRef.current.filter(
      segment => now - (segment.endTime || now) < 3000
    );
  }, [isArrhythmia, isMonitoring]);

  const analyzeRRIntervals = useCallback((intervals: number[]): boolean => {
    if (intervals.length < MIN_RR_INTERVALS) return false;
    
    const lastIntervals = intervals.slice(-8);
    
    const meanRR = lastIntervals.reduce((sum, val) => sum + val, 0) / lastIntervals.length;
    
    let sumSquares = 0;
    for (let i = 1; i < lastIntervals.length; i++) {
      const diff = lastIntervals[i] - lastIntervals[i-1];
      sumSquares += diff * diff;
    }
    
    const rmssd = Math.sqrt(sumSquares / (lastIntervals.length - 1));
    const rrVariation = rmssd / meanRR;
    
    return rrVariation > ARRHYTHMIA_THRESHOLD;
  }, []);

  const detectPeaksAndAnalyzeRR = useCallback((points: PPGDataPointExtended[], now: number) => {
    if (points.length < PEAK_DETECTION_WINDOW) return;
    
    const potentialPeaks: {index: number, value: number, time: number, isArrhythmia?: boolean}[] = [];
    
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
        const isInArrhythmiaSegment = arrhythmiaSegmentsRef.current.some(segment => {
          const endTime = segment.endTime || now;
          return currentPoint.time >= segment.startTime && currentPoint.time <= endTime;
        });
        
        potentialPeaks.push({
          index: i,
          value: currentPoint.value,
          time: currentPoint.time,
          isArrhythmia: isInArrhythmiaSegment
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
        
        if (lastPeakTimeRef.current !== null) {
          const rrInterval = peak.time - lastPeakTimeRef.current;
          
          if (rrInterval >= 400 && rrInterval <= 1500) {
            rrIntervalsRef.current.push(rrInterval);
            
            if (rrIntervalsRef.current.length > 20) {
              rrIntervalsRef.current.shift();
            }
            
            const hasArrhythmia = analyzeRRIntervals(rrIntervalsRef.current);
            
            if (hasArrhythmia) {
              consecutiveAnomaliesRef.current++;
              
              if (consecutiveAnomaliesRef.current >= CONSECUTIVE_ANOMALIES_THRESHOLD) {
                const timeSinceLastArrhythmia = now - lastArrhythmiaTimeRef.current;
                const canDetectNewArrhythmia = 
                  timeSinceLastArrhythmia > MIN_TIME_BETWEEN_ARRHYTHMIAS &&
                  arrhythmiaCountRef.current < MAX_ARRHYTHMIAS_PER_SESSION;
                
                if (canDetectNewArrhythmia) {
                  arrhythmiaDetectedRef.current = true;
                  arrhythmiaCountRef.current++;
                  lastArrhythmiaTimeRef.current = now;
                  consecutiveAnomaliesRef.current = 0;
                  
                  peak.isArrhythmia = true;
                  
                  console.log('PPGSignalMeter: Arritmia detectada', {
                    counter: arrhythmiaCountRef.current,
                    timestamp: new Date(now).toISOString(),
                    rrVariation: hasArrhythmia
                  });
                }
              }
            } else {
              consecutiveAnomaliesRef.current = 0;
            }
          }
        }
        
        lastPeakTimeRef.current = peak.time;
        requestBeepForPeak(peak.time);
      }
    }
    
    peaksRef.current.sort((a, b) => a.time - b.time);
    
    peaksRef.current = peaksRef.current
      .filter(peak => now - peak.time < WINDOW_WIDTH_MS)
      .slice(-MAX_PEAKS_TO_DISPLAY);
  }, [analyzeRRIntervals, requestBeepForPeak]);

  const getAverageQuality = useCallback(() => {
    if (qualityHistoryRef.current.length === 0) return 0;
    
    let weightedSum = 0;
    let weightSum = 0;
    
    qualityHistoryRef.current.forEach((q, index) => {
      const weight = Math.pow(1.3, index);
      weightedSum += q * weight;
      weightSum += weight;
    });
    
    let avgQuality = weightSum > 0 ? weightedSum / weightSum : 0;
    
    if (signalAmplitudeHistoryRef.current.length > 10) {
      const avgAmplitude = signalAmplitudeHistoryRef.current.reduce((sum, amp) => sum + amp, 0) / 
                          signalAmplitudeHistoryRef.current.length;
      
      if (avgAmplitude < MIN_AMPLITUDE_THRESHOLD) {
        avgQuality = Math.max(0, avgQuality * 0.4);
      }
    }
    
    if (noiseBufferRef.current.length > 10) {
      const noiseLevel = calculateNoiseLevel(noiseBufferRef.current);
      if (noiseLevel > MAX_NOISE_RATIO) {
        avgQuality = Math.max(0, avgQuality * 0.5);
      }
    }
    
    if (derivativeBufferRef.current.length > 10) {
      const avgDerivative = derivativeBufferRef.current.reduce((sum, d) => sum + d, 0) / 
                           derivativeBufferRef.current.length;
      
      if (avgDerivative < MIN_DERIVATIVE_THRESHOLD) {
        avgQuality = Math.max(0, avgQuality * 0.6);
      }
    }
    
    return avgQuality;
  }, []);

  const calculateNoiseLevel = useCallback((values: number[]): number => {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev / (Math.abs(mean) + 0.001);
  }, []);

  const getTrueFingerDetection = useCallback(() => {
    const avgQuality = getAverageQuality();
    
    const hasStableDetection = detectionStabilityCounterRef.current >= REQUIRED_STABILITY_FRAMES;
    const hasMinimumQuality = avgQuality > 35;
    const hasRequiredFrames = consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES;
    
    let hasSignalVariability = false;
    if (derivativeBufferRef.current.length > 10) {
      const maxDerivative = Math.max(...derivativeBufferRef.current);
      hasSignalVariability = maxDerivative > MIN_DERIVATIVE_THRESHOLD;
    }
    
    let hasSufficientAmplitude = false;
    if (signalAmplitudeHistoryRef.current.length > 10) {
      const avgAmplitude = signalAmplitudeHistoryRef.current.reduce((sum, a) => sum + a, 0) / 
                          signalAmplitudeHistoryRef.current.length;
      hasSufficientAmplitude = avgAmplitude > MIN_AMPLITUDE_THRESHOLD;
    }
    
    return hasStableDetection && hasMinimumQuality && hasRequiredFrames && 
           (hasSignalVariability || hasSufficientAmplitude);
  }, [getAverageQuality]);

  const getQualityColor = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    const isFingerDetected = getTrueFingerDetection();
    
    if (!isFingerDetected) return 'from-gray-400 to-gray-500';
    if (avgQuality > 70) return 'from-green-500 to-emerald-500';
    if (avgQuality > 45) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  }, [getAverageQuality, getTrueFingerDetection]);

  const getQualityText = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    const isFingerDetected = getTrueFingerDetection();
    
    if (!isFingerDetected) return 'Sin detección';
    if (avgQuality > 70) return 'Señal óptima';
    if (avgQuality > 45) return 'Señal aceptable';
    return 'Señal débil';
  }, [getAverageQuality, getTrueFingerDetection]);

  const smoothValue = useCallback((currentValue: number, previousValue: number | null): number => {
    if (previousValue === null) return currentValue;
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

  useEffect(() => {
    const heartBeatProcessor = (window as any).heartBeatProcessor;
    
    if (heartBeatProcessor) {
      beepRequesterRef.current = (timestamp: number) => {
        try {
          heartBeatProcessor.playBeep(1.0);
          console.log("PPGSignalMeter: Beep requested for peak at timestamp", timestamp);
        } catch (err) {
          console.error("Error requesting beep:", err);
        }
      };
    }
    
    return () => {
      beepRequesterRef.current = null;
    };
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
    
    if (isMonitoring && isFingerDetected && quality > 20) {
      if (baselineRef.current === null) {
        baselineRef.current = value;
      } else {
        const adaptationRate = isFingerDetected ? 0.97 : 0.95;
        baselineRef.current = baselineRef.current * adaptationRate + value * (1 - adaptationRate);
      }
      
      const smoothedValue = smoothValue(value, lastValueRef.current);
      lastValueRef.current = smoothedValue;
      
      const normalizedValue = (baselineRef.current || 0) - smoothedValue;
      const scaledValue = normalizedValue * verticalScale;
      
      const pointIsArrhythmia = arrhythmiaDetectedRef.current;
      
      const dataPoint: PPGDataPointExtended = {
        time: now,
        value: scaledValue,
        isArrhythmia: pointIsArrhythmia
      };
      
      dataBufferRef.current.push(dataPoint);
      
      const points = dataBufferRef.current.getPoints();
      detectPeaksAndAnalyzeRR(points, now);
      
      if (points.length > 1) {
        let segmentPoints: {x: number, y: number, isArrhythmia: boolean}[] = [];
        let currentSegmentIsArrhythmia = false;
        
        for (let i = 0; i < points.length; i++) {
          const point = points[i];
          
          point.isArrhythmia = point.isArrhythmia || isPointInArrhythmiaSegment(point.time, now);
          
          const x = canvas.width - ((now - point.time) * canvas.width / WINDOW_WIDTH_MS);
          const y = (canvas.height / 2) - CANVAS_CENTER_OFFSET - point.value;
          
          if (i === 0 || currentSegmentIsArrhythmia !== !!point.isArrhythmia) {
            if (segmentPoints.length > 0) {
              renderCtx.beginPath();
              renderCtx.strokeStyle = getSignalColor(currentSegmentIsArrhythmia);
              renderCtx.lineWidth = 2;
              renderCtx.lineJoin = 'round';
              renderCtx.lineCap = 'round';
              
              if (window.devicePixelRatio > 1) {
                renderCtx.shadowBlur = 0.5;
                renderCtx.shadowColor = getSignalColor(currentSegmentIsArrhythmia);
              }
              
              for (let j = 0; j < segmentPoints.length; j++) {
                const segPoint = segmentPoints[j];
                if (j === 0) {
                  renderCtx.moveTo(segPoint.x, segPoint.y);
                } else {
                  renderCtx.lineTo(segPoint.x, segPoint.y);
                }
              }
              
              renderCtx.stroke();
              if (window.devicePixelRatio > 1) {
                renderCtx.shadowBlur = 0;
              }
              
              segmentPoints = [];
            }
            
            currentSegmentIsArrhythmia = !!point.isArrhythmia;
          }
          
          segmentPoints.push({
            x,
            y,
            isArrhythmia: !!point.isArrhythmia
          });
        }
        
        if (segmentPoints.length > 0) {
          renderCtx.beginPath();
          renderCtx.strokeStyle = getSignalColor(currentSegmentIsArrhythmia);
          renderCtx.lineWidth = 2;
          renderCtx.lineJoin = 'round';
          renderCtx.lineCap = 'round';
          
          if (window.devicePixelRatio > 1) {
            renderCtx.shadowBlur = 0.5;
            renderCtx.shadowColor = getSignalColor(currentSegmentIsArrhythmia);
          }
          
          for (let j = 0; j < segmentPoints.length; j++) {
            const segPoint = segmentPoints[j];
            if (j === 0) {
              renderCtx.moveTo(segPoint.x, segPoint.y);
            } else {
              renderCtx.lineTo(segPoint.x, segPoint.y);
            }
          }
          
          renderCtx.stroke();
          if (window.devicePixelRatio > 1) {
            renderCtx.shadowBlur = 0;
          }
        }
        
        peaksRef.current.forEach(peak => {
          const peakX = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
          const peakY = (canvas.height / 2) - CANVAS_CENTER_OFFSET - peak.value;
          
          if (peakX >= 0 && peakX <= canvas.width) {
            renderCtx.beginPath();
            renderCtx.fillStyle = peak.isArrhythmia ? ARRHYTHMIA_COLOR : NORMAL_COLOR;
            renderCtx.arc(peakX, peakY, peak.isArrhythmia ? ARRHYTHMIA_INDICATOR_SIZE : 5, 0, Math.PI * 2);
            renderCtx.fill();
            
            if (peak.isArrhythmia) {
              const timeSincePeak = now - peak.time;
              if (timeSincePeak < ARRHYTHMIA_DURATION_MS) {
                const pulseSize = 5 + (timeSincePeak / ARRHYTHMIA_DURATION_MS) * 15;
                
                renderCtx.beginPath();
                renderCtx.strokeStyle = ARRHYTHMIA_PULSE_COLOR;
                renderCtx.lineWidth = 1.5;
                renderCtx.globalAlpha = 1 - (timeSincePeak / ARRHYTHMIA_DURATION_MS);
                renderCtx.arc(peakX, peakY, pulseSize, 0, Math.PI * 2);
                renderCtx.stroke();
                renderCtx.globalAlpha = 1.0;
              }
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
      
      lastRenderTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(renderSignal);
    } else {
      if (dataBufferRef.current) {
        dataBufferRef.current.clear();
      }
      
      if (isMonitoring) {
        renderCtx.font = 'bold 24px Inter';
        renderCtx.fillStyle = '#ffffff';
        renderCtx.textAlign = 'center';
        renderCtx.fillText("Coloque su dedo en la cámara", canvas.width/2, canvas.height/2);
      } else {
        renderCtx.font = 'bold 24px Inter';
        renderCtx.fillStyle = '#ffffff';
        renderCtx.textAlign = 'center';
        renderCtx.fillText("Presione INICIAR para comenzar", canvas.width/2, canvas.height/2);
      }
      
      if (USE_OFFSCREEN_CANVAS && offscreenCanvasRef.current) {
        const visibleCtx = canvas.getContext('2d', { alpha: false });
        if (visibleCtx) {
          visibleCtx.drawImage(offscreenCanvasRef.current, 0, 0);
        }
      }
      
      lastRenderTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(renderSignal);
    }
  }, [
    drawGrid, 
    smoothValue, 
    detectPeaksAndAnalyzeRR, 
    isFingerDetected, 
    quality, 
    value, 
    isMonitoring,
    isPointInArrhythmiaSegment
  ]);

  useEffect(() => {
    renderSignal();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderSignal]);

  return (
    <div className="relative w-full rounded-lg overflow-hidden bg-gradient-to-b from-gray-900 to-gray-800 shadow-xl">
      <div className="absolute top-2 left-2 z-10">
        <AppTitle />
      </div>
      
      <div className="absolute top-2 right-2 z-10 flex flex-col items-end">
        <div className={`text-white text-xs px-2 py-1 rounded-full bg-gradient-to-r ${getQualityColor(quality)}`}>
          {getQualityText(quality)}
        </div>
        {arrhythmiaStatus && (
          <div className={`mt-1 text-white text-xs px-2 py-1 rounded-full ${isArrhythmia ? 'bg-red-500' : 'bg-blue-500'}`}>
            {arrhythmiaStatus}
          </div>
        )}
      </div>
      
      <div className="absolute bottom-2 right-2 z-10">
        <div className="flex gap-2">
          <button 
            onClick={onReset}
            className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-full text-sm"
          >
            Limpiar
          </button>
          <button 
            onClick={onStartMeasurement}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1 rounded-full text-sm"
          >
            Iniciar
          </button>
        </div>
      </div>
      
      <div className="absolute bottom-2 left-2 z-10">
        {isFingerDetected ? (
          <div className="flex items-center">
            <Fingerprint className="text-emerald-400 mr-1" size={18} />
            <span className="text-white text-xs">Dedo detectado</span>
          </div>
        ) : (
          <div className="flex items-center">
            <Fingerprint className="text-gray-400 mr-1" size={18} />
            <span className="text-gray-300 text-xs">Sin detección</span>
          </div>
        )}
      </div>
      
      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT}
        className="w-full h-auto"
      />
    </div>
  );
});

export default PPGSignalMeter;
