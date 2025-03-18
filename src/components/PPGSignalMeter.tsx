
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
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
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

  const CANVAS_CENTER_OFFSET = 60;
  const WINDOW_WIDTH_MS = 5500;
  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 720;
  const GRID_SIZE_X = 30;
  const GRID_SIZE_Y = 5;
  const verticalScale = 45.0;
  const SMOOTHING_FACTOR = 1.5;
  const TARGET_FPS = 60;
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 500;
  const PEAK_DETECTION_WINDOW = 6;
  const PEAK_THRESHOLD = 1.7;
  const MIN_PEAK_DISTANCE_MS = 250;
  const IMMEDIATE_RENDERING = true;
  const MAX_PEAKS_TO_DISPLAY = 20;
  const REQUIRED_FINGER_FRAMES = 3;
  const QUALITY_HISTORY_SIZE = 9;
  const USE_OFFSCREEN_CANVAS = true;
  const ARRHYTHMIA_COLOR = '#FF2E2E';
  const NORMAL_COLOR = '#0EA5E9';
  const ARRHYTHMIA_INDICATOR_SIZE = 8;
  const ARRHYTHMIA_PULSE_COLOR = '#FFDA00';
  const ARRHYTHMIA_DURATION_MS = 800;

  // Configuración de audio
  const BEEP_PRIMARY_FREQUENCY = 880;
  const BEEP_SECONDARY_FREQUENCY = 440;
  const BEEP_DURATION = 80;
  const BEEP_VOLUME = 0.9;
  const MIN_BEEP_INTERVAL_MS = 350; // Aumentado para evitar beeps muy cercanos

  // Inicializar el contexto de audio
  useEffect(() => {
    const initAudio = async () => {
      try {
        if (!audioContextRef.current && typeof AudioContext !== 'undefined') {
          console.log("PPGSignalMeter: Inicializando Audio Context");
          audioContextRef.current = new AudioContext({ latencyHint: 'interactive' });
          
          if (audioContextRef.current.state !== 'running') {
            await audioContextRef.current.resume();
          }
          
          // Beep de inicialización silencioso
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

  // Función para reproducir beep SOLO cuando se dibuja un círculo
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
      
      // Resetear la bandera de pico pendiente
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
    
    const effectivePeakThreshold = 1.8;
    
    // Solo analizar puntos positivos (parte superior de la onda)
    for (let i = PEAK_DETECTION_WINDOW; i < points.length - PEAK_DETECTION_WINDOW; i++) {
      const currentPoint = points[i];
      
      // Solo considerar picos positivos para evitar detección doble
      if (currentPoint.value <= 0) continue;
      
      const minPeakDistance = 180;
      
      const recentlyProcessed = peaksRef.current.some(
        peak => Math.abs(peak.time - currentPoint.time) < minPeakDistance
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
      
      if (isPeak && Math.abs(currentPoint.value) > effectivePeakThreshold) {
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
        // Generar ID único para este pico
        const peakId = Date.now() + Math.random();
        
        peaksRef.current.push({
          time: peak.time,
          value: peak.value,
          isArrhythmia: peak.isArrhythmia,
          beepPlayed: false // Marcar que aún no se ha reproducido beep para este pico
        });
        
        // Marcar este pico como pendiente para beep en la fase de renderizado
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
  }, [isFingerDetected]);

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
      const adaptationRate = isFingerDetected ? 0.97 : 0.95;
      baselineRef.current = baselineRef.current * adaptationRate + value * (1 - adaptationRate);
    }
    
    const smoothedValue = smoothValue(value, lastValueRef.current);
    lastValueRef.current = smoothedValue;
    
    const normalizedValue = (baselineRef.current || 0) - smoothedValue;
    const scaledValue = normalizedValue * verticalScale;
    
    const pointIsArrhythmia = isArrhythmia;
    
    const dataPoint: PPGDataPointExtended = {
      time: now,
      value: scaledValue,
      isArrhythmia: pointIsArrhythmia
    };
    
    dataBufferRef.current.push(dataPoint);
    
    const points = dataBufferRef.current.getPoints();
    detectPeaks(points, now);
    
    // Variable para controlar si se dibujó algún círculo y podemos emitir beep
    let shouldBeep = false;
    
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
        
        segmentPoints.push({ x, y, isArrhythmia: !!point.isArrhythmia });
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
      
      // Dibujar círculos en los picos detectados y activar beep solo al dibujar un círculo
      if (peaksRef.current.length > 0) {
        peaksRef.current.forEach(peak => {
          const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
          const y = (canvas.height / 2) - CANVAS_CENTER_OFFSET - peak.value;
          
          if (x >= 0 && x <= canvas.width) {
            const peakColor = getSignalColor(!!peak.isArrhythmia);
            
            // DIBUJAR CÍRCULO AQUÍ - Esto es lo que queremos enlazar con el beep
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
              
              // Activar bandera de beep si no se ha reproducido para este pico
              if (!peak.beepPlayed) {
                shouldBeep = true;
                peak.beepPlayed = true;
              }
            } else {
              renderCtx.fillStyle = peakColor;
              renderCtx.beginPath();
              renderCtx.arc(x, y, 5, 0, Math.PI * 2);
              renderCtx.fill();
              
              // Activar bandera de beep si no se ha reproducido para este pico
              if (!peak.beepPlayed) {
                shouldBeep = true;
                peak.beepPlayed = true;
              }
            }
            
            renderCtx.font = 'bold 16px Inter';
            renderCtx.fillStyle = peak.isArrhythmia ? '#ea384c' : '#000000';
            renderCtx.textAlign = 'center';
            renderCtx.fillText(Math.abs(peak.value / verticalScale).toFixed(2), x, y - 15);
          }
        });
      }
    }
    
    // Actualizar visibleCanvas desde el offscreen
    if (USE_OFFSCREEN_CANVAS && offscreenCanvasRef.current) {
      const visibleCtx = canvas.getContext('2d', { alpha: false });
      if (visibleCtx) {
        visibleCtx.drawImage(offscreenCanvasRef.current, 0, 0);
      }
    }
    
    // Reproducir beep SOLO si se dibujó un círculo y hay picos pendientes
    if (shouldBeep && pendingBeepPeakIdRef.current && isFingerDetected && 
        consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES) {
      console.log("PPGSignalMeter: Círculo dibujado, reproduciendo beep (un beep por latido)");
      playBeep(1.0);
    }
    
    lastRenderTimeRef.current = currentTime;
    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [value, quality, isFingerDetected, drawGrid, detectPeaks, smoothValue, preserveResults, isArrhythmia, isPointInArrhythmiaSegment, playBeep]);

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
