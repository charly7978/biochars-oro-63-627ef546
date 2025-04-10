
import React, { useEffect, useRef, useCallback, useState, memo } from 'react';
import { Fingerprint, AlertCircle, Heart, Activity, LineChart } from 'lucide-react';
import { CircularBuffer } from '../utils/CircularBuffer';
import { PPGDataPoint, CardiacMetrics } from '../hooks/heart-beat/types';
import AppTitle from './AppTitle';
import PPGSummaryDialog from './PPGSummaryDialog';
import { calculateCardiacMetrics, getQualityDescription } from '../utils/displayOptimizer';

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
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  const pendingBeepPeakIdRef = useRef<number | null>(null);
  const [showSummaryDialog, setShowSummaryDialog] = useState<boolean>(false);
  const [cardiacMetrics, setCardiacMetrics] = useState<CardiacMetrics>({
    bpm: 0,
    confidence: 0,
    rrVariability: 0,
    rrIntervalAvg: 0,
    rrIntervalMin: 0,
    rrIntervalMax: 0,
    waveformAmplitude: 0,
    qualityScore: 0,
    arrhythmiaCount: 0
  });
  const lastTimeStamp = useRef<number>(0);
  const measurementTimeRef = useRef<number>(0);
  const measurementIntervalRef = useRef<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

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

  // Actualiza el tiempo transcurrido cuando se está monitoreando
  useEffect(() => {
    if (isFingerDetected && !preserveResults) {
      if (measurementIntervalRef.current === null) {
        const startTime = Date.now();
        lastTimeStamp.current = startTime;
        
        measurementIntervalRef.current = window.setInterval(() => {
          const now = Date.now();
          const elapsed = Math.floor((now - startTime) / 1000);
          setElapsedTime(elapsed);
          measurementTimeRef.current = elapsed;
        }, 1000);
      }
    } else {
      if (measurementIntervalRef.current !== null) {
        clearInterval(measurementIntervalRef.current);
        measurementIntervalRef.current = null;
      }
    }

    return () => {
      if (measurementIntervalRef.current !== null) {
        clearInterval(measurementIntervalRef.current);
        measurementIntervalRef.current = null;
      }
    };
  }, [isFingerDetected, preserveResults]);

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
        // No limpiar el búfer para mantener los datos para el resumen
        // dataBufferRef.current.clear();
      }
      // No resetear los picos para el diálogo de resumen
      // peaksRef.current = [];
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
    
    // Iniciar la animación
    animationFrameRef.current = requestAnimationFrame(renderSignal);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Calcular métricas cardíacas periódicamente
  useEffect(() => {
    if (dataBufferRef.current && dataBufferRef.current.size() > 10) {
      const data = dataBufferRef.current.toArray();
      const metrics = calculateCardiacMetrics(data, currentBPM, quality);
      setCardiacMetrics(metrics);
    }
  }, [currentBPM, quality, value]);

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
    gradient.addColorStop(0, 'rgba(15, 23, 42, 0.9)');
    gradient.addColorStop(1, 'rgba(30, 41, 59, 0.9)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < CANVAS_WIDTH; i += 20) {
      for (let j = 0; j < CANVAS_HEIGHT; j += 20) {
        ctx.fillStyle = j % 40 === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(100,100,100,0.1)';
        ctx.fillRect(i, j, 10, 10);
      }
    }
    ctx.globalAlpha = 1.0;
    
    // Dibuja líneas de grid más profesionales
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    
    // Líneas verticales representando ms
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE_X) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      if (x % (GRID_SIZE_X * 5) === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '10px "Inter", sans-serif';
        ctx.textAlign = 'center';
        const timeMs = Math.round((x / CANVAS_WIDTH) * WINDOW_WIDTH_MS);
        const timeS = (timeMs / 1000).toFixed(1);
        ctx.fillText(`${timeS}s`, x, CANVAS_HEIGHT - 5);
      }
    }
    
    // Líneas horizontales
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE_Y) {
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
    }
    ctx.stroke();
    
    // Línea de base (eje x)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.moveTo(0, CANVAS_HEIGHT / 2);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Título profesional y sutil en la parte superior
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 14px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ELECTROCARDIOGRAMA PPG', 15, 25);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '11px "Inter", sans-serif';
    ctx.fillText('Datos en tiempo real', 15, 45);
    
    // Muestra información adicional si hay datos de arritmia
    if (arrhythmiaStatus) {
      const [status, count] = arrhythmiaStatus.split('|');
      
      if (status.includes("ARRITMIA") && count === "1" && !showArrhythmiaAlert) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        ctx.fillRect(30, 70, 350, 40);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(30, 70, 350, 40);
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 14px "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('¡SE DETECTÓ UNA ARRITMIA!', 45, 95);
        setShowArrhythmiaAlert(true);
      } else if (status.includes("ARRITMIA") && Number(count) > 1) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        ctx.fillRect(30, 70, 250, 40);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(30, 70, 250, 40);
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 14px "Inter", sans-serif';
        ctx.textAlign = 'left';
        const redPeaksCount = peaksRef.current.filter(peak => peak.isArrhythmia).length;
        ctx.fillText(`Arritmias detectadas: ${count}`, 45, 95);
      }
    }
  }, [arrhythmiaStatus, showArrhythmiaAlert]);

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
        potentialPeaks.push({
          index: i,
          value: currentPoint.value,
          time: currentPoint.time,
          isArrhythmia: currentPoint.isArrhythmia || false
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
  }, []);

  const updateBPM = useCallback(() => {
    if (peaksRef.current.length < 2) return;
    
    // Calcular BPM a partir de los intervalos RR
    const intervals: number[] = [];
    for (let i = 1; i < peaksRef.current.length; i++) {
      const interval = peaksRef.current[i].time - peaksRef.current[i-1].time;
      if (interval > 300 && interval < 2000) { // Valores fisiológicamente plausibles
        intervals.push(interval);
      }
    }
    
    if (intervals.length === 0) return;
    
    // Calcular la media de los intervalos excluyendo outliers
    intervals.sort((a, b) => a - b);
    const validIntervals = intervals.slice(
      Math.floor(intervals.length * 0.1),
      Math.ceil(intervals.length * 0.9)
    );
    
    if (validIntervals.length === 0) return;
    
    const avgInterval = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    const newBPM = Math.round(60000 / avgInterval);
    
    // Aplicar un filtro para suavizar cambios bruscos
    if (currentBPM === 0) {
      setCurrentBPM(newBPM);
    } else {
      setCurrentBPM(prevBPM => Math.round(prevBPM * 0.7 + newBPM * 0.3));
    }
  }, [currentBPM]);

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
    
    // Añadir punto al buffer
    if (isFingerDetected && consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES) {
      dataBufferRef.current.push({
        time: now,
        value: scaledValue,
        isPeak: false,
        isArrhythmia: currentIsArrhythmia
      });
      
      // Detectar picos y actualizar BPM
      const points = dataBufferRef.current.toArray();
      detectPeaks(points, now);
      updateBPM();
      
      // Dibujar la señal PPG
      renderCtx.beginPath();
      renderCtx.lineWidth = 2.5;
      renderCtx.lineCap = 'round';
      renderCtx.lineJoin = 'round';
      renderCtx.strokeStyle = currentIsArrhythmia ? '#ef4444' : '#0ea5e9';
      
      let firstPoint = true;
      
      points.forEach(point => {
        const age = now - point.time;
        if (age <= WINDOW_WIDTH_MS) {
          const x = CANVAS_WIDTH - (age / WINDOW_WIDTH_MS) * CANVAS_WIDTH;
          const y = CANVAS_HEIGHT / 2 - point.value;
          
          if (firstPoint) {
            renderCtx.moveTo(x, y);
            firstPoint = false;
          } else {
            renderCtx.lineTo(x, y);
          }
        }
      });
      
      renderCtx.stroke();
      
      // Dibujar picos
      peaksRef.current.forEach(peak => {
        const age = now - peak.time;
        if (age <= WINDOW_WIDTH_MS) {
          const x = CANVAS_WIDTH - (age / WINDOW_WIDTH_MS) * CANVAS_WIDTH;
          const pointIndex = points.findIndex(p => Math.abs(p.time - peak.time) < 50);
          
          if (pointIndex >= 0) {
            const y = CANVAS_HEIGHT / 2 - points[pointIndex].value;
            
            // Dibujar círculo para el pico
            renderCtx.beginPath();
            renderCtx.arc(x, y, 6, 0, 2 * Math.PI);
            renderCtx.fillStyle = peak.isArrhythmia ? '#ef4444' : '#10b981';
            renderCtx.fill();
            
            // Dibujar borde del círculo
            renderCtx.beginPath();
            renderCtx.arc(x, y, 8, 0, 2 * Math.PI);
            renderCtx.strokeStyle = peak.isArrhythmia ? 'rgba(239, 68, 68, 0.5)' : 'rgba(16, 185, 129, 0.5)';
            renderCtx.lineWidth = 2;
            renderCtx.stroke();
            
            // Dibujar línea vertical hasta el eje
            renderCtx.beginPath();
            renderCtx.setLineDash([2, 2]);
            renderCtx.moveTo(x, y);
            renderCtx.lineTo(x, CANVAS_HEIGHT / 2);
            renderCtx.strokeStyle = peak.isArrhythmia ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)';
            renderCtx.lineWidth = 1;
            renderCtx.stroke();
            renderCtx.setLineDash([]);
            
            // Reproducir beep en el pico si no se ha reproducido ya
            if (!peak.beepPlayed) {
              const shouldBeep = true; // Control para activar/desactivar sonidos
              if (shouldBeep) {
                playBeep(peak.isArrhythmia ? 1.0 : 0.8);
                peak.beepPlayed = true;
              }
            }
          }
        }
      });
      
      // Mostrar métricas cardíacas en la pantalla
      renderCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      renderCtx.font = '12px "Inter", sans-serif';
      renderCtx.textAlign = 'right';
      
      const metrics = [
        { label: 'FC', value: `${currentBPM} BPM` },
        { label: 'RRavg', value: `${Math.round(cardiacMetrics.rrIntervalAvg)} ms` },
        { label: 'VFC', value: `${Math.round(cardiacMetrics.rrVariability)} ms` },
        { label: 'Calidad', value: `${Math.round(cardiacMetrics.qualityScore)}%` }
      ];
      
      metrics.forEach((metric, index) => {
        renderCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        renderCtx.textAlign = 'right';
        renderCtx.fillText(metric.label, CANVAS_WIDTH - 60, 30 + index * 20);
        
        renderCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        renderCtx.textAlign = 'left';
        renderCtx.fillText(metric.value, CANVAS_WIDTH - 55, 30 + index * 20);
      });
    }
    
    // Copiar del canvas offscreen al visible
    if (USE_OFFSCREEN_CANVAS && offscreenCanvasRef.current) {
      const visibleCtx = canvas.getContext('2d', { alpha: false });
      if (visibleCtx) {
        visibleCtx.drawImage(offscreenCanvasRef.current, 0, 0);
      }
    }
    
    lastRenderTimeRef.current = currentTime;
    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [detectPeaks, drawGrid, isFingerDetected, playBeep, smoothValue, value, arrhythmiaStatus, rawArrhythmiaData, isArrhythmia, preserveResults, updateBPM, currentBPM, cardiacMetrics.rrIntervalAvg, cardiacMetrics.rrVariability, cardiacMetrics.qualityScore]);

  // Mostrar el diálogo de resumen cuando se detiene el monitoreo y hay datos
  useEffect(() => {
    if (preserveResults && dataBufferRef.current && dataBufferRef.current.size() > 0 && !isFingerDetected) {
      // Mostrar el resumen automáticamente después de un breve retraso
      const timer = setTimeout(() => {
        setShowSummaryDialog(true);
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [preserveResults, isFingerDetected]);

  // Callback para mostrar el resumen
  const handleShowSummary = useCallback(() => {
    if (dataBufferRef.current && dataBufferRef.current.size() > 0) {
      setShowSummaryDialog(true);
    }
  }, []);

  // Convertir datos a formato para el diálogo de resumen
  const getPPGDataForSummary = useCallback(() => {
    if (!dataBufferRef.current) return [];
    return dataBufferRef.current.toArray().map(point => ({
      time: point.time,
      value: point.value,
      isPeak: peaksRef.current.some(peak => Math.abs(peak.time - point.time) < 50),
      isArrhythmia: point.isArrhythmia
    }));
  }, []);

  return (
    <>
      <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full object-contain"
        />
        
        {!isFingerDetected && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-gray-900/70 backdrop-blur-sm rounded-lg p-6 flex flex-col items-center max-w-md">
              <Fingerprint className="h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-medium text-white">Coloque su dedo en la cámara</h3>
              <p className="text-gray-300 mt-2 text-center">
                Cubra la lente de la cámara con la yema de su dedo para comenzar a medir sus signos vitales
              </p>
            </div>
          </div>
        )}
        
        {preserveResults && !isFingerDetected && dataBufferRef.current && dataBufferRef.current.size() > 0 && (
          <div className="absolute bottom-4 right-4">
            <button
              onClick={handleShowSummary}
              className="bg-sky-600 hover:bg-sky-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2"
            >
              <Activity className="h-4 w-4" />
              Ver Análisis Completo
            </button>
          </div>
        )}
        
        {showArrhythmiaAlert && isFingerDetected && (
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600/90 text-white px-3 py-2 rounded-lg animate-pulse">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Arritmia detectada</span>
          </div>
        )}
        
        <div className="absolute bottom-4 left-4 px-4 py-2 bg-slate-900/60 backdrop-blur-sm rounded-lg border border-slate-700/20">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${getQualityColor(quality)}`}></div>
            <span className="text-sm font-medium text-white">{getQualityText(quality)}</span>
          </div>
        </div>
        
        {isFingerDetected && (
          <div className="absolute top-4 left-4 px-4 py-2 bg-slate-900/60 backdrop-blur-sm rounded-lg border border-slate-700/20 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-500" />
              <span className="text-sm font-medium text-white">{currentBPM} BPM</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-400" />
              <span className="text-sm font-medium text-white">{elapsedTime}s</span>
            </div>
          </div>
        )}
      </div>
      
      <PPGSummaryDialog
        isOpen={showSummaryDialog}
        onClose={() => setShowSummaryDialog(false)}
        signalData={getPPGDataForSummary()}
        cardiacMetrics={cardiacMetrics}
        measurementTime={measurementTimeRef.current}
        vitals={{
          spo2: typeof vitals?.spo2 === 'number' ? vitals.spo2 : '--',
          pressure: vitals?.pressure || '--/--',
          arrhythmiaStatus: vitals?.arrhythmiaStatus || '--'
        }}
      />
    </>
  );
});

export default PPGSignalMeter;
