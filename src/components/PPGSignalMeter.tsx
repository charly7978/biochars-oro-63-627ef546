
import React, { useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Fingerprint } from 'lucide-react';
import { CircularBuffer, PPGDataPoint } from '../utils/CircularBuffer';
import AppTitle from './AppTitle';
import { 
  getSignalColor, 
  optimizeCanvas, 
  optimizeElement, 
  optimizeCanvasDrawing,
  shouldSkipFrame,
  createSmoothBuffer
} from '../utils/displayOptimizer';

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

// Configuración del medidor de señal PPG con optimizaciones de rendimiento
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
  // Referencias y estado
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
  const arrhythmiaSegmentsRef = useRef<Array<{startTime: number, endTime: number | null}>>([]);
  const pendingBeepPeakIdRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const renderCountRef = useRef(0);
  const skipFramesRef = useRef(0);
  
  // Audio context y referencias para beeps optimizados
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  
  // Constantes optimizadas
  const CANVAS_CENTER_OFFSET = 60;
  const WINDOW_WIDTH_MS = 5000; // Reducido para menor carga
  const CANVAS_WIDTH = window.innerWidth > 1000 ? 1920 : 1280;
  const CANVAS_HEIGHT = 860;
  const GRID_SIZE_X = 30;
  const GRID_SIZE_Y = 5;
  const verticalScale = 65.0;
  const SMOOTHING_FACTOR = 0.8; // Reducido para mayor fluidez
  const TARGET_FPS = isMobile() ? 30 : 60; // Adaptativo según dispositivo
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 300; // Reducido para menor uso de memoria
  const PEAK_DETECTION_WINDOW = 5; // Optimizado
  const PEAK_THRESHOLD = 1.8; // Ajustado
  const MIN_PEAK_DISTANCE_MS = 250;
  const MAX_PEAKS_TO_DISPLAY = 10; // Reducido
  const REQUIRED_FINGER_FRAMES = 3;
  const QUALITY_HISTORY_SIZE = 7; // Reducido
  const USE_OFFSCREEN_CANVAS = !isMobile(); // Desactivar en móviles
  const NORMAL_COLOR = '#0EA5E9';
  const ARRHYTHMIA_COLOR = '#FF2E2E';
  
  // Parámetros de audio optimizados
  const BEEP_PRIMARY_FREQUENCY = 880;
  const BEEP_DURATION = 80;
  const BEEP_VOLUME = 0.8;
  const MIN_BEEP_INTERVAL_MS = 350;
  
  // Detectar si es dispositivo móvil para optimizaciones específicas
  function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  // Memoizar el color para evitar recálculos
  const currentColor = useMemo(() => 
    getSignalColor(isArrhythmia), 
    [isArrhythmia]
  );

  // Inicializar buffer de datos
  useEffect(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer<PPGDataPointExtended>(BUFFER_SIZE);
    }
    
    // Inicializar canvas de cuadrícula una sola vez
    if (!gridCanvasRef.current) {
      const gridCanvas = document.createElement('canvas');
      gridCanvas.width = CANVAS_WIDTH;
      gridCanvas.height = CANVAS_HEIGHT;
      const gridCtx = gridCanvas.getContext('2d', { alpha: false });
      
      if (gridCtx) {
        drawGrid(gridCtx);
        gridCanvasRef.current = gridCanvas;
      }
    }
    
    // Inicializar canvas offscreen para mejor rendimiento
    if (USE_OFFSCREEN_CANVAS && !offscreenCanvasRef.current) {
      const offscreen = new OffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
      offscreenCanvasRef.current = offscreen;
    }
    
    initializedRef.current = true;
  }, []);
  
  // Inicializar contexto de audio
  useEffect(() => {
    const initAudio = async () => {
      try {
        if (!audioContextRef.current && typeof AudioContext !== 'undefined') {
          audioContextRef.current = new AudioContext({ latencyHint: 'interactive' });
          
          // Crear buffer de audio pregenerado para mejor rendimiento
          if (audioContextRef.current) {
            const sampleRate = audioContextRef.current.sampleRate;
            const buffer = audioContextRef.current.createBuffer(1, sampleRate * BEEP_DURATION / 1000, sampleRate);
            const channel = buffer.getChannelData(0);
            
            // Generar forma de onda sinusoidal previamente
            for (let i = 0; i < buffer.length; i++) {
              const t = i / sampleRate;
              // Mezcla de dos frecuencias para un tono más rico pero eficiente
              channel[i] = 0.6 * Math.sin(2 * Math.PI * BEEP_PRIMARY_FREQUENCY * t) + 
                          0.4 * Math.sin(2 * Math.PI * (BEEP_PRIMARY_FREQUENCY/2) * t);
              
              // Aplicar envolvente ADSR para suavizar inicio y final
              if (i < buffer.length * 0.1) {
                // Attack
                channel[i] *= i / (buffer.length * 0.1);
              } else if (i > buffer.length * 0.7) {
                // Release
                channel[i] *= (buffer.length - i) / (buffer.length * 0.3);
              }
            }
            
            audioBufferRef.current = buffer;
            
            // Crear nodo de ganancia reutilizable
            audioGainRef.current = audioContextRef.current.createGain();
            audioGainRef.current.connect(audioContextRef.current.destination);
            
            // Beep de inicialización silencioso para activar audio
            await playBeep(0.01);
          }
        }
      } catch (err) {
        console.error("Error inicializando audio:", err);
      }
    };
    
    initAudio();
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(err => {
          console.error("Error cerrando audio context:", err);
        });
        audioContextRef.current = null;
        audioBufferRef.current = null;
        audioGainRef.current = null;
      }
    };
  }, []);
  
  // Optimizar el elemento canvas
  useEffect(() => {
    if (canvasRef.current) {
      optimizeCanvas(canvasRef.current, CANVAS_WIDTH, CANVAS_HEIGHT);
      optimizeElement(canvasRef.current);
    }
  }, []);
  
  // Cálculo de calidad de señal
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
  
  // Resetear datos cuando se preservan resultados
  useEffect(() => {
    if (preserveResults && !isFingerDetected) {
      if (dataBufferRef.current) {
        dataBufferRef.current.clear();
      }
      peaksRef.current = [];
      baselineRef.current = null;
      lastValueRef.current = null;
    }
  }, [preserveResults, isFingerDetected]);
  
  // Función para reproducir beep optimizada
  const playBeep = useCallback(async (volume = BEEP_VOLUME) => {
    try {
      const now = Date.now();
      if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS) {
        return false;
      }
      
      if (!audioContextRef.current || !audioBufferRef.current) {
        return false;
      }
      
      if (audioContextRef.current.state !== 'running') {
        await audioContextRef.current.resume();
        if (audioContextRef.current.state !== 'running') {
          return false;
        }
      }
      
      // Usar buffer pregenerado para mayor eficiencia
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferRef.current;
      
      // Usar nodo de ganancia existente para evitar crear nuevos
      if (audioGainRef.current) {
        audioGainRef.current.gain.value = Math.min(volume, 1.0);
        source.connect(audioGainRef.current);
      } else {
        const gain = audioContextRef.current.createGain();
        gain.gain.value = Math.min(volume, 1.0);
        source.connect(gain);
        gain.connect(audioContextRef.current.destination);
      }
      
      source.start();
      lastBeepTimeRef.current = now;
      
      // Resetear el ID del pico pendiente
      pendingBeepPeakIdRef.current = null;
      
      return true;
    } catch (err) {
      console.error("Error reproduciendo beep:", err);
      return false;
    }
  }, []);
  
  // Obtener calidad promedio ponderada
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
  
  // Determinar color de calidad
  const getQualityColor = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    
    if (!(consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES)) return 'from-gray-400 to-gray-500';
    if (avgQuality > 65) return 'from-green-500 to-emerald-500';
    if (avgQuality > 40) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  }, [getAverageQuality]);
  
  // Texto descriptivo de calidad
  const getQualityText = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    
    if (!(consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES)) return 'Sin detección';
    if (avgQuality > 65) return 'Señal óptima';
    if (avgQuality > 40) return 'Señal aceptable';
    return 'Señal débil';
  }, [getAverageQuality]);
  
  // Suavizado de valores con optimización
  const smoothValue = useCallback((currentValue: number, previousValue: number | null): number => {
    if (previousValue === null) return currentValue;
    return createSmoothBuffer(currentValue, previousValue, SMOOTHING_FACTOR);
  }, [SMOOTHING_FACTOR]);
  
  // Dibujar cuadrícula de fondo (una sola vez)
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    // Crear fondo con gradiente
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#E2DCFF');
    gradient.addColorStop(0.25, '#FFDECF');
    gradient.addColorStop(0.45, '#F1FBDF');
    gradient.addColorStop(0.55, '#F1EEE8');
    gradient.addColorStop(0.75, '#F5EED8');
    gradient.addColorStop(1, '#F5EED0');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Dibujar grid con bajo alpha para mejor rendimiento
    ctx.globalAlpha = 0.04;
    
    // Dibujar menos elementos en dispositivos móviles
    const gridStep = isMobile() ? 40 : 20;
    
    for (let i = 0; i < CANVAS_WIDTH; i += gridStep) {
      for (let j = 0; j < CANVAS_HEIGHT; j += gridStep) {
        ctx.fillStyle = j % (gridStep*2) === 0 ? 
          `rgba(0,0,0,0.2)` : 
          `rgba(255,255,255,0.2)`;
        ctx.fillRect(i, j, gridStep/2, gridStep/2);
      }
    }
    ctx.globalAlpha = 1.0;
    
    // Dibujar ejes principales
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.22)';
    ctx.lineWidth = 0.5;
    
    // Dibujar menos líneas de cuadrícula en móviles
    const gridXStep = isMobile() ? GRID_SIZE_X * 2 : GRID_SIZE_X;
    
    for (let x = 0; x <= CANVAS_WIDTH; x += gridXStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
    }
    
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE_Y) {
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
    }
    ctx.stroke();
    
    // Dibujar línea central
    const centerLineY = (CANVAS_HEIGHT / 2) - CANVAS_CENTER_OFFSET;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.moveTo(0, centerLineY);
    ctx.lineTo(CANVAS_WIDTH, centerLineY);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_CENTER_OFFSET]);
  
  // Verificar si un punto está en un segmento de arritmia
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
  
  // Detección de picos optimizada
  const detectPeaks = useCallback((points: PPGDataPointExtended[], now: number) => {
    if (points.length < PEAK_DETECTION_WINDOW) return;
    
    // Solo analizar cada N puntos para mejorar rendimiento
    const stride = isMobile() ? 2 : 1;
    const potentialPeaks: {index: number, value: number, time: number, isArrhythmia?: boolean}[] = [];
    
    // Solo analizar puntos positivos (parte superior de la onda)
    for (let i = PEAK_DETECTION_WINDOW; i < points.length - PEAK_DETECTION_WINDOW; i += stride) {
      const currentPoint = points[i];
      
      // Solo considerar picos positivos
      if (currentPoint.value <= 0) continue;
      
      // Evitar procesar picos muy cercanos a los ya detectados
      const recentlyProcessed = peaksRef.current.some(
        peak => Math.abs(peak.time - currentPoint.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (recentlyProcessed) continue;
      
      // Algoritmo de detección de picos optimizado
      let isPeak = true;
      
      // Verificar si es mayor que los puntos anteriores
      for (let j = i - PEAK_DETECTION_WINDOW; j < i; j += stride) {
        if (points[j].value >= currentPoint.value) {
          isPeak = false;
          break;
        }
      }
      
      // Verificar si es mayor que los puntos siguientes
      if (isPeak) {
        for (let j = i + stride; j <= i + PEAK_DETECTION_WINDOW; j += stride) {
          if (j < points.length && points[j].value > currentPoint.value) {
            isPeak = false;
            break;
          }
        }
      }
      
      // Si es un pico y supera el umbral, agregarlo
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
    
    // Procesar picos potenciales
    for (const peak of potentialPeaks) {
      // Verificar que no esté demasiado cerca de picos existentes
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
          beepPlayed: false
        });
        
        // Programar beep para este pico
        if (isFingerDetected && consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES) {
          pendingBeepPeakIdRef.current = peakId;
        }
      }
    }
    
    // Limitar número de picos almacenados
    peaksRef.current.sort((a, b) => a.time - b.time);
    peaksRef.current = peaksRef.current
      .filter(peak => now - peak.time < WINDOW_WIDTH_MS)
      .slice(-MAX_PEAKS_TO_DISPLAY);
  }, [isFingerDetected]);
  
  // Renderizado optimizado de la señal
  const renderSignal = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dataBufferRef.current || !initializedRef.current) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    // Control de FPS para rendimiento optimizado
    const currentTime = performance.now();
    
    // Saltear frames para mantener FPS consistentes
    if (shouldSkipFrame(lastRenderTimeRef.current, TARGET_FPS)) {
      skipFramesRef.current++;
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    // Contador de renderizado para diagnóstico
    renderCountRef.current++;
    if (renderCountRef.current % 100 === 0 && process.env.NODE_ENV === 'development') {
      console.log(`Rendimiento PPG: ${Math.round(1000 / (currentTime - lastRenderTimeRef.current))} FPS, Frames saltados: ${skipFramesRef.current}`);
      skipFramesRef.current = 0;
    }
    
    // Seleccionar contexto apropiado
    const renderCtx = USE_OFFSCREEN_CANVAS && offscreenCanvasRef.current ? 
      offscreenCanvasRef.current.getContext('2d', { alpha: false }) : 
      canvas.getContext('2d', { alpha: false });
    
    if (!renderCtx) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    // Optimizar contexto
    optimizeCanvasDrawing(renderCtx);
    
    const now = Date.now();
    
    // Dibujar fondo (grid)
    if (gridCanvasRef.current) {
      renderCtx.drawImage(gridCanvasRef.current, 0, 0);
    } else {
      drawGrid(renderCtx);
    }
    
    // Preservar resultados si es necesario
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
    
    // Establecer línea base
    if (baselineRef.current === null) {
      baselineRef.current = value;
    } else {
      const adaptationRate = isFingerDetected ? 0.97 : 0.95;
      baselineRef.current = baselineRef.current * adaptationRate + value * (1 - adaptationRate);
    }
    
    // Suavizar valor
    const smoothedValue = smoothValue(value, lastValueRef.current);
    lastValueRef.current = smoothedValue;
    
    // Normalizar y escalar
    const normalizedValue = (baselineRef.current || 0) - smoothedValue;
    const scaledValue = normalizedValue * verticalScale;
    
    // Agregar punto al buffer
    const dataPoint: PPGDataPointExtended = {
      time: now,
      value: scaledValue,
      isArrhythmia: isArrhythmia
    };
    
    dataBufferRef.current.push(dataPoint);
    
    // Detectar picos
    const points = dataBufferRef.current.getPoints();
    detectPeaks(points, now);
    
    // Variable para controlar si se dibujó algún círculo
    let shouldBeep = false;
    
    // Dibujar puntos y líneas
    if (points.length > 1) {
      // Batch drawing - Agrupar los puntos por estado de arritmia
      let segmentPoints: {x: number, y: number, isArrhythmia: boolean}[] = [];
      let currentSegmentIsArrhythmia = false;
      
      // Optimización: usar menos puntos en dispositivos móviles
      const pointStride = isMobile() ? 2 : 1;
      
      for (let i = 0; i < points.length; i += pointStride) {
        const point = points[i];
        
        point.isArrhythmia = point.isArrhythmia || isPointInArrhythmiaSegment(point.time, now);
        
        const x = canvas.width - ((now - point.time) * canvas.width / WINDOW_WIDTH_MS);
        const y = (canvas.height / 2) - CANVAS_CENTER_OFFSET - point.value;
        
        // Si cambia el estado de arritmia, dibujar el segmento anterior
        if (i === 0 || currentSegmentIsArrhythmia !== !!point.isArrhythmia) {
          if (segmentPoints.length > 0) {
            renderCtx.beginPath();
            renderCtx.strokeStyle = getSignalColor(currentSegmentIsArrhythmia);
            renderCtx.lineWidth = 2;
            
            // Optimización: no usar efectos visuales en dispositivos móviles
            if (!isMobile() && window.devicePixelRatio > 1) {
              renderCtx.shadowBlur = 0.5;
              renderCtx.shadowColor = getSignalColor(currentSegmentIsArrhythmia);
            }
            
            // Dibujar línea con optimización para muchos puntos
            renderCtx.moveTo(segmentPoints[0].x, segmentPoints[0].y);
            
            // En dispositivos móviles, usar menos puntos intermedios
            const linePointStride = isMobile() ? 2 : 1;
            
            for (let j = linePointStride; j < segmentPoints.length; j += linePointStride) {
              renderCtx.lineTo(segmentPoints[j].x, segmentPoints[j].y);
            }
            
            renderCtx.stroke();
            if (!isMobile() && window.devicePixelRatio > 1) {
              renderCtx.shadowBlur = 0;
            }
            
            segmentPoints = [];
          }
          
          currentSegmentIsArrhythmia = !!point.isArrhythmia;
        }
        
        segmentPoints.push({ x, y, isArrhythmia: !!point.isArrhythmia });
      }
      
      // Dibujar el último segmento
      if (segmentPoints.length > 0) {
        renderCtx.beginPath();
        renderCtx.strokeStyle = getSignalColor(currentSegmentIsArrhythmia);
        renderCtx.lineWidth = 2;
        
        if (!isMobile() && window.devicePixelRatio > 1) {
          renderCtx.shadowBlur = 0.5;
          renderCtx.shadowColor = getSignalColor(currentSegmentIsArrhythmia);
        }
        
        renderCtx.moveTo(segmentPoints[0].x, segmentPoints[0].y);
        
        const linePointStride = isMobile() ? 2 : 1;
        for (let j = linePointStride; j < segmentPoints.length; j += linePointStride) {
          renderCtx.lineTo(segmentPoints[j].x, segmentPoints[j].y);
        }
        
        renderCtx.stroke();
        if (!isMobile() && window.devicePixelRatio > 1) {
          renderCtx.shadowBlur = 0;
        }
      }
      
      // Dibujar círculos en los picos detectados
      if (peaksRef.current.length > 0) {
        // Limitar número de círculos para mejorar rendimiento
        const visiblePeaks = peaksRef.current
          .filter(peak => {
            const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
            return x >= 0 && x <= canvas.width;
          })
          .slice(-5); // Solo mostrar los 5 más recientes
        
        visiblePeaks.forEach(peak => {
          const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
          const y = (canvas.height / 2) - CANVAS_CENTER_OFFSET - peak.value;
          
          const peakColor = getSignalColor(!!peak.isArrhythmia);
          
          // DIBUJAR CÍRCULO - Esto activará el beep
          renderCtx.fillStyle = peakColor;
          renderCtx.beginPath();
          renderCtx.arc(x, y, 5, 0, Math.PI * 2);
          renderCtx.fill();
          
          // Activar bandera de beep si no se ha reproducido para este pico
          if (!peak.beepPlayed) {
            shouldBeep = true;
            peak.beepPlayed = true;
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
    
    // Reproducir beep SOLO si se dibujó un círculo y tenemos picos pendientes
    if (shouldBeep && pendingBeepPeakIdRef.current && isFingerDetected && 
        consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES) {
      playBeep(1.0);
    }
    
    lastRenderTimeRef.current = currentTime;
    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [
    value, quality, isFingerDetected, drawGrid, detectPeaks, 
    smoothValue, preserveResults, isArrhythmia, 
    isPointInArrhythmiaSegment, playBeep,
    WINDOW_WIDTH_MS, CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_CENTER_OFFSET, TARGET_FPS
  ]);
  
  // Iniciar renderizado
  useEffect(() => {
    renderSignal();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderSignal]);
  
  // Función de reset
  const handleReset = useCallback(() => {
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
        className="w-full h-full absolute inset-0 z-0 object-cover"
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
