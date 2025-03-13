import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Fingerprint, AlertCircle } from 'lucide-react';
import { CircularBuffer, PPGDataPoint } from '../utils/CircularBuffer';

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
}

const PPGSignalMeter = ({ 
  value, 
  quality, 
  isFingerDetected,
  onStartMeasurement,
  onReset,
  arrhythmiaStatus,
  rawArrhythmiaData,
  preserveResults = false
}: PPGSignalMeterProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataBufferRef = useRef<CircularBuffer | null>(null);
  const baselineRef = useRef<number | null>(null);
  const lastValueRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);
  const lastArrhythmiaTime = useRef<number>(0);
  const arrhythmiaCountRef = useRef<number>(0);
  const peaksRef = useRef<{time: number, value: number, isArrhythmia: boolean}[]>([]);
  const [showArrhythmiaAlert, setShowArrhythmiaAlert] = useState(false);
  const qualityHistoryRef = useRef<number[]>([]);
  const consecutiveFingerFramesRef = useRef<number>(0);
  const lastValueTimeRef = useRef<number>(0);

  // Constantes optimizadas para fluidez
  const WINDOW_WIDTH_MS = 4000; // 4 segundos de ventana (reducida)
  const CANVAS_WIDTH = 2400;
  const CANVAS_HEIGHT = 1080;
  const GRID_SIZE_X = 35;
  const GRID_SIZE_Y = 5;
  const verticalScale = 40.0;
  const SMOOTHING_FACTOR = 0.6; // Reducido para respuesta más inmediata
  const TARGET_FPS = 120; // Máxima fluidez
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 300; // Optimizado para rendimiento
  const PEAK_DETECTION_WINDOW = 6; // Reducido para menor latencia
  const PEAK_THRESHOLD = 2.2; // Ajustado para mejor detección
  const MIN_PEAK_DISTANCE_MS = 220;
  const MAX_PEAKS_TO_DISPLAY = 12; // Reducido para mejor rendimiento
  const REQUIRED_FINGER_FRAMES = 1; // Respuesta inmediata
  const QUALITY_HISTORY_SIZE = 2;
  const BASELINE_ADAPTATION_RATE = 0.92; // Adaptación más rápida
  
  // Constantes para sincronización precisa
  const USE_PRECISE_TIMING = true;
  const FLOW_DIRECTION = 'rtl'; // 'rtl' (derecha a izquierda) o 'ltr' (izquierda a derecha)
  
  useEffect(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer(BUFFER_SIZE);
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

  // Actualizar historial de calidad
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

  // Cálculo de calidad promedio
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

  // Color según calidad
  const getQualityColor = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    const isFingerConfirmed = consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES;
    
    if (!isFingerConfirmed) return 'from-gray-400 to-gray-500';
    if (avgQuality > 65) return 'from-green-500 to-emerald-500';
    if (avgQuality > 40) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  }, [getAverageQuality]);

  // Texto informativo de calidad
  const getQualityText = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    const isFingerConfirmed = consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES;
    
    if (!isFingerConfirmed) return 'Sin detección';
    if (avgQuality > 65) return 'Señal óptima';
    if (avgQuality > 40) return 'Señal aceptable';
    return 'Señal débil';
  }, [getAverageQuality]);

  // Suavizado optimizado para reducir latencia
  const smoothValue = useCallback((currentValue: number, previousValue: number | null): number => {
    if (previousValue === null) return currentValue;
    // Suavizado mínimo con prioridad a valores actuales para menor latencia
    return previousValue * SMOOTHING_FACTOR + currentValue * (1 - SMOOTHING_FACTOR);
  }, []);

  // Dibujado de cuadrícula
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#E5DEFF');
    gradient.addColorStop(0.3, '#FDE1D3');
    gradient.addColorStop(0.7, '#F2FCE2');
    gradient.addColorStop(1, '#D3E4FD');
    
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
    
    const centerLineY = (CANVAS_HEIGHT / 2) - 40;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.moveTo(0, centerLineY);
    ctx.lineTo(CANVAS_WIDTH, centerLineY);
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
  }, [arrhythmiaStatus, showArrhythmiaAlert]);

  // Detección de picos optimizada
  const detectPeaks = useCallback((points: PPGDataPoint[], now: number) => {
    if (points.length < PEAK_DETECTION_WINDOW) return;
    
    // Usar solo los N últimos puntos para reducir carga computacional
    const recentPoints = points.slice(-Math.min(points.length, 30));
    const potentialPeaks: {index: number, value: number, time: number, isArrhythmia: boolean}[] = [];
    
    for (let i = PEAK_DETECTION_WINDOW; i < recentPoints.length - PEAK_DETECTION_WINDOW; i++) {
      const currentPoint = recentPoints[i];
      
      // Evitar procesar picos ya detectados
      const recentlyProcessed = peaksRef.current.some(
        peak => Math.abs(peak.time - currentPoint.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (recentlyProcessed) continue;
      
      // Algoritmo simplificado de detección de picos
      let isPeak = true;
      
      for (let j = i - PEAK_DETECTION_WINDOW; j < i; j++) {
        if (recentPoints[j].value >= currentPoint.value) {
          isPeak = false;
          break;
        }
      }
      
      if (isPeak) {
        for (let j = i + 1; j <= i + PEAK_DETECTION_WINDOW; j++) {
          if (j < recentPoints.length && recentPoints[j].value > currentPoint.value) {
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
          isArrhythmia: currentPoint.isArrhythmia
        });
      }
    }
    
    // Procesar picos potenciales
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
      }
    }
    
    // Ordenar picos por tiempo
    peaksRef.current.sort((a, b) => a.time - b.time);
    
    // Mantener solo picos recientes y limitar cantidad
    peaksRef.current = peaksRef.current
      .filter(peak => now - peak.time < WINDOW_WIDTH_MS)
      .slice(-MAX_PEAKS_TO_DISPLAY);
  }, []);

  // Renderizado optimizado con desync
  const renderSignal = useCallback(() => {
    if (!canvasRef.current || !dataBufferRef.current) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const currentTime = performance.now();
    const timeSinceLastRender = currentTime - lastRenderTimeRef.current;
    
    // Control de framerate para estabilidad
    if (timeSinceLastRender < FRAME_TIME) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true // Crucial para reducir latencia
    });
    
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const now = USE_PRECISE_TIMING ? performance.now() : Date.now();
    
    drawGrid(ctx);
    
    if (preserveResults && !isFingerDetected) {
      lastRenderTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    // Procesamiento inmediato sin retardos
    if (isFingerDetected && value !== 0) {
      // Timestamp preciso para cada punto
      const pointTimestamp = performance.now();
      lastValueTimeRef.current = pointTimestamp;
      
      // Adaptación rápida de línea base
      if (baselineRef.current === null) {
        baselineRef.current = value;
      } else {
        // Adaptación más rápida para evitar "drift"
        baselineRef.current = baselineRef.current * BASELINE_ADAPTATION_RATE + 
                            value * (1 - BASELINE_ADAPTATION_RATE);
      }
      
      // Aplicar suavizado mínimo para respuesta rápida
      const smoothedValue = smoothValue(value, lastValueRef.current);
      lastValueRef.current = smoothedValue;
      
      // Normalización consistente
      const normalizedValue = baselineRef.current - smoothedValue;
      const scaledValue = normalizedValue * verticalScale;
      
      // Detección simplificada de arritmias
      let isArrhythmia = false;
      if (rawArrhythmiaData && arrhythmiaStatus?.includes("ARRITMIA") && 
          now - rawArrhythmiaData.timestamp < 300) {
        isArrhythmia = true;
        lastArrhythmiaTime.current = now;
      }
      
      // Crear punto con timestamp preciso
      const dataPoint: PPGDataPoint = {
        time: pointTimestamp, // Usar timestamp preciso
        value: scaledValue,
        isArrhythmia
      };
      
      // Agregar punto al buffer
      dataBufferRef.current.push(dataPoint);
    }
    
    // Obtener puntos y detectar picos
    const points = dataBufferRef.current.getPoints();
    detectPeaks(points, now);
    
    // Renderizado optimizado de la señal
    if (points.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#0EA5E9';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      let firstPoint = true;
      let lastX = 0;
      let lastY = 0;
      const centerY = (CANVAS_HEIGHT / 2) - 40;
      
      // Dibujar onda de derecha a izquierda (más nuevo a la derecha)
      const renderPoints = [...points]; // Copia para evitar modificaciones durante renderizado
      
      for (let i = 0; i < renderPoints.length; i++) {
        const point = renderPoints[i];
        
        // Cálculo preciso de posición temporal
        let x;
        if (FLOW_DIRECTION === 'rtl') {
          // Derecha a izquierda (más nuevo a la derecha)
          x = CANVAS_WIDTH - ((now - point.time) * CANVAS_WIDTH / WINDOW_WIDTH_MS);
        } else {
          // Izquierda a derecha (más nuevo a la izquierda)
          x = (now - point.time) * CANVAS_WIDTH / WINDOW_WIDTH_MS;
        }
        
        const y = centerY - point.value;
        
        // No dibujar fuera del canvas
        if (x < 0 || x > CANVAS_WIDTH) continue;
        
        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
        
        // Dibujar segmentos de arritmia en rojo
        if (point.isArrhythmia && i > 0) {
          // Cerrar el trazo actual
          ctx.stroke();
          
          // Comenzar nuevo trazo en rojo
          ctx.beginPath(); 
          ctx.strokeStyle = '#DC2626';
          ctx.moveTo(lastX, lastY);
          ctx.lineTo(x, y);
          ctx.stroke();
          
          // Volver al trazo normal
          ctx.beginPath();
          ctx.strokeStyle = '#0EA5E9';
          ctx.moveTo(x, y);
          firstPoint = true;
        }
        
        lastX = x;
        lastY = y;
      }
      
      ctx.stroke();
      
      // Dibujar los picos detectados con posición precisa
      ctx.lineWidth = 2;
      peaksRef.current.forEach((peak) => {
        // Calcular posición X basada en timestamp
        let x;
        if (FLOW_DIRECTION === 'rtl') {
          // Derecha a izquierda (más nuevo a la derecha)
          x = CANVAS_WIDTH - ((now - peak.time) * CANVAS_WIDTH / WINDOW_WIDTH_MS);
        } else {
          // Izquierda a derecha (más nuevo a la izquierda)
          x = (now - peak.time) * CANVAS_WIDTH / WINDOW_WIDTH_MS;
        }
        
        const y = centerY - peak.value;
        
        // Solo dibujar picos visibles
        if (x >= 0 && x <= CANVAS_WIDTH) {
          // Círculo del pico
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fillStyle = peak.isArrhythmia ? '#DC2626' : '#0EA5E9';
          ctx.fill();
          
          // Resaltar arritmias
          if (peak.isArrhythmia) {
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.strokeStyle = '#FEF7CD';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.font = 'bold 18px Inter';
            ctx.fillStyle = '#F97316';
            ctx.textAlign = 'center';
            ctx.fillText('ARRITMIA', x, y - 25);
          }
          
          // Valor numérico
          ctx.font = 'bold 16px Inter';
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          ctx.fillText(Math.abs(peak.value / verticalScale).toFixed(2), x, y - 15);
        }
      });
    }
    
    lastRenderTimeRef.current = currentTime;
    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [value, quality, isFingerDetected, rawArrhythmiaData, arrhythmiaStatus, drawGrid, detectPeaks, smoothValue, preserveResults]);

  // Iniciar renderizado con alta prioridad
  useEffect(() => {
    // Usar rAF con alta prioridad si está disponible
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
    } else {
      const interval = setInterval(renderSignal, FRAME_TIME);
      return () => clearInterval(interval);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderSignal]);

  // Manejador de reset
  const handleReset = useCallback(() => {
    setShowArrhythmiaAlert(false);
    peaksRef.current = [];
    onReset();
  }, [onReset]);

  // Determinar si usar calidad mejorada para UI
  const displayQuality = getAverageQuality();
  const displayFingerDetected = consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES;

  return (
    <div className="fixed inset-0 bg-black/5 backdrop-blur-[1px] flex flex-col">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-full absolute inset-0 z-0 object-cover"
      />

      <div className="absolute top-0 left-0 right-0 p-1 flex justify-between items-center bg-transparent z-10 pt-3">
        <div className="flex items-center gap-2">
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
};

export default PPGSignalMeter;
