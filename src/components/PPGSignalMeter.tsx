import React, { useEffect, useRef, useCallback, useState, memo } from 'react';
import { Fingerprint } from 'lucide-react';
import { CircularBuffer, PPGDataPoint } from '../utils/CircularBuffer';
import HeartRateService from '../services/HeartRateService';
import { PeakData } from '@/types/peak';

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
  arrhythmiaWindows = []
}: PPGSignalMeterProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataBufferRef = useRef<CircularBuffer<PPGDataPointExtended> | null>(null);
  const baselineRef = useRef<number | null>(null);
  const lastValueRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);
  const showArrhythmiaAlertRef = useRef<boolean>(false);
  const [showArrhythmiaAlert, setShowArrhythmiaAlert] = useState(false);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qualityHistoryRef = useRef<number[]>([]);
  const consecutiveFingerFramesRef = useRef<number>(0);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [resultsVisible, setResultsVisible] = useState(true);
  const peaksRef = useRef<{time: number, value: number, beepPlayed: boolean}[]>([]);
  
  // Configuración optimizada para visualización de señal PPG
  const WINDOW_WIDTH_MS = 4500;
  const CANVAS_WIDTH = 700;
  const CANVAS_HEIGHT = 1000;
  const GRID_SIZE_X = 10;
  const GRID_SIZE_Y = 5;
  const VERTICAL_SCALE = 76.0;
  const SMOOTHING_FACTOR = 1.5;
  const TARGET_FPS = 60;
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 600;
  const QUALITY_HISTORY_SIZE = 9;
  const REQUIRED_FINGER_FRAMES = 3;
  const USE_OFFSCREEN_CANVAS = true;
  
  // Parámetros refinados para visualización precisa de picos
  const PEAK_DISPLAY_RADIUS = 5;  // Tamaño del círculo para mejor visibilidad
  const PEAK_TEXT_OFFSET = 22;    // Distancia optimizada para texto
  const PEAK_VALUE_FONT = '11px Inter';  // Fuente legible
  const PEAK_VISIBLE_MARGIN = 10;  // Margen reducido para mantener visibilidad sin cortar picos

  // Constantes para análisis de picos
  const MIN_PEAK_AMPLITUDE = 3.0;  // Amplitud mínima para considerar un pico como significativo
  const MIN_PEAK_DISTANCE = 300;   // Distancia mínima entre picos en ms (200ms = 300BPM máximo)

  useEffect(() => {
    const handlePeakDetection = (peakData: PeakData) => {
      const now = Date.now();
      
      // Almacenar pico sin información de arritmia
      if (peakData && peakData.timestamp && peakData.value) {
        peaksRef.current.push({
          time: peakData.timestamp,
          value: peakData.value * VERTICAL_SCALE,
          beepPlayed: true // Asumir que el beep normal se intentó
        });
        
        // Mantener una cantidad razonable de picos en memoria
        while (peaksRef.current.length > 20) {
          peaksRef.current.shift();
        }
        
        console.log("PPGSignalMeter: Peak received", {
          timestamp: new Date(peakData.timestamp).toISOString(),
          value: peakData.value
        });
      }
    };
    
    HeartRateService.addPeakListener(handlePeakDetection);
    
    return () => {
      HeartRateService.removePeakListener(handlePeakDetection);
    };
  }, []);

  useEffect(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer<PPGDataPointExtended>(BUFFER_SIZE);
    }
    
    HeartRateService.setMonitoring(isFingerDetected);
    
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
    }
  }, [preserveResults, isFingerDetected]);

  useEffect(() => {
    qualityHistoryRef.current.push(quality);
    if (qualityHistoryRef.current.length > QUALITY_HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    if (isFingerDetected) {
      consecutiveFingerFramesRef.current++;
      setResultsVisible(true);
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

  // Función para suavizar valores sin simulación, utilizando solo los datos reales entrantes
  const smoothValue = useCallback((currentValue: number, previousValue: number | null): number => {
    if (previousValue === null) return currentValue;
    return previousValue + SMOOTHING_FACTOR * (currentValue - previousValue);
  }, []);

  // Dibujo del grid base sin simulación
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    // Cambio a fondo negro
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < CANVAS_WIDTH; i += 20) {
      for (let j = 0; j < CANVAS_HEIGHT; j += 20) {
        ctx.fillStyle = j % 40 === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)';
        ctx.fillRect(i, j, 10, 10);
      }
    }
    ctx.globalAlpha = 1.0;
    
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 0.5;
    
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE_X) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      if (x % (GRID_SIZE_X * 5) === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(x.toString(), x, CANVAS_HEIGHT - 5);
      }
    }
    
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE_Y) {
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      if (y % (GRID_SIZE_Y * 5) === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(y.toString(), 15, y + 3);
      }
    }
    ctx.stroke();
    
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
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
        showArrhythmiaAlertRef.current = true;
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

  // Función para dibujar zonas de arritmia, sin simulación
  const drawArrhythmiaZones = useCallback((ctx: CanvasRenderingContext2D, now: number) => {
    const currentWindows = arrhythmiaWindows || []; 
    
    if (!currentWindows || currentWindows.length === 0) {
      return;
    }
    
    currentWindows.forEach(window => {
      const windowStartTime = window.start;
      const windowEndTime = window.end;
      
      const windowVisible = (now - windowStartTime < WINDOW_WIDTH_MS || now - windowEndTime < WINDOW_WIDTH_MS);
      
      if (windowVisible) {
        const startX = ctx.canvas.width - ((now - windowStartTime) * ctx.canvas.width / WINDOW_WIDTH_MS);
        const endX = ctx.canvas.width - ((now - windowEndTime) * ctx.canvas.width / WINDOW_WIDTH_MS);
        const width = Math.max(10, endX - startX);
        
        const adjustedStartX = Math.max(0, startX);
        const adjustedWidth = Math.min(width, ctx.canvas.width - adjustedStartX);
        
        ctx.fillStyle = 'rgba(220, 38, 38, 0.15)';
        ctx.fillRect(adjustedStartX, 0, adjustedWidth, ctx.canvas.height);
        
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        
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
      }
    });
  }, [WINDOW_WIDTH_MS, arrhythmiaWindows]);

  // Función para detectar picos en tiempo real sin simulación
  const detectRealTimePeaks = useCallback((points: PPGDataPointExtended[], now: number): {x: number, y: number, time: number, value: number, isArrhythmia: boolean}[] => {
    if (!points || points.length < 3) return [];
    
    const result: {x: number, y: number, time: number, value: number, isArrhythmia: boolean}[] = [];
    const middleY = CANVAS_HEIGHT / 2 - 50;
    
    // Analizar puntos para detectar máximos locales (picos reales)
    for (let i = 2; i < points.length - 2; i++) {
      const p1 = points[i-2];
      const p2 = points[i-1];
      const current = points[i];
      const n1 = points[i+1];
      const n2 = points[i+2];
      
      // Un punto es un pico si es mayor que sus vecinos en una ventana de 5 puntos
      if (current.value > p1.value && 
          current.value > p2.value && 
          current.value > n1.value && 
          current.value > n2.value) {
            
        // Calcular la amplitud del pico para filtrar ruido
        const prevTrough = Math.min(p1.value, p2.value);
        const nextTrough = Math.min(n1.value, n2.value);
        const amplitude = current.value - Math.min(prevTrough, nextTrough);
        
        if (amplitude > MIN_PEAK_AMPLITUDE) {
          // Verificar si este pico está demasiado cerca de otro ya detectado
          let isTooClose = false;
          
          for (const existingPeak of result) {
            if (Math.abs(current.time - existingPeak.time) < MIN_PEAK_DISTANCE) {
              // Si ya hay un pico cercano, quedarse con el de mayor amplitud
              if (current.value > existingPeak.value) {
                // Reemplazar el pico existente con este
                const idx = result.indexOf(existingPeak);
                if (idx !== -1) result.splice(idx, 1);
              } else {
                isTooClose = true;
              }
              break;
            }
          }
          
          if (!isTooClose) {
            // Calcular posición real en canvas
            const x = CANVAS_WIDTH - ((now - current.time) * CANVAS_WIDTH / WINDOW_WIDTH_MS);
            const y = middleY - current.value;
            
            // Solo incluir picos visibles en el área de visualización
            if (x >= PEAK_VISIBLE_MARGIN && 
                x <= CANVAS_WIDTH - PEAK_VISIBLE_MARGIN && 
                y >= PEAK_VISIBLE_MARGIN && 
                y <= CANVAS_HEIGHT - PEAK_VISIBLE_MARGIN) {
              
              result.push({
                x, 
                y,
                time: current.time, 
                value: current.value / VERTICAL_SCALE, // Valor real normalizado
                isArrhythmia: current.isArrhythmia || false
              });
            }
          }
        }
      }
    }
    
    return result;
  }, [CANVAS_HEIGHT, CANVAS_WIDTH, WINDOW_WIDTH_MS, PEAK_VISIBLE_MARGIN, VERTICAL_SCALE]);

  const renderSignal = useCallback(() => {
    if (!canvasRef.current || !dataBufferRef.current) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const currentTime = performance.now();
    const timeSinceLastRender = currentTime - lastRenderTimeRef.current;
    
    if (timeSinceLastRender < FRAME_TIME) {
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
    
    // Actualizar línea base con medición real sin simulación
    if (baselineRef.current === null) {
      baselineRef.current = value;
    } else {
      baselineRef.current = baselineRef.current * 0.95 + value * 0.05;
    }
    
    const smoothedValue = smoothValue(value, lastValueRef.current);
    lastValueRef.current = smoothedValue;
    
    const normalizedValue = smoothedValue - (baselineRef.current || 0);
    const scaledValue = normalizedValue * VERTICAL_SCALE;
    
    if (isFingerDetected && consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES) {
      // Solo procesar la señal cuando realmente hay un dedo detectado
      HeartRateService.processSignal(value);
    }
    
    const dataPoint: PPGDataPointExtended = {
      time: now,
      value: scaledValue,
      isArrhythmia: isArrhythmia || false
    };
    
    dataBufferRef.current.push(dataPoint);
    
    const points = dataBufferRef.current.getPoints();
    
    if (points.length > 1) {
      // Detectar picos en tiempo real de la señal actual
      const realTimePeaks = detectRealTimePeaks(points, now);
      
      // Dibujar líneas de la forma de onda PPG
      for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i - 1];
        const currentPoint = points[i];
        
        const x1 = canvas.width - ((now - prevPoint.time) * canvas.width / WINDOW_WIDTH_MS);
        const y1 = (canvas.height / 2 - 50) - prevPoint.value;
        
        const x2 = canvas.width - ((now - currentPoint.time) * canvas.width / WINDOW_WIDTH_MS);
        const y2 = (canvas.height / 2 - 50) - currentPoint.value;
        
        // Determinar si el segmento actual cae DENTRO de una ventana de arritmia confirmada
        const isInArrhythmiaZone = 
          arrhythmiaWindows.some(window => 
            (currentPoint.time >= window.start && currentPoint.time <= window.end) ||
            (prevPoint.time >= window.start && prevPoint.time <= window.end)
          );
        
        renderCtx.beginPath();
        // El color de la ONDA solo depende de si está en una VENTANA
        renderCtx.strokeStyle = isInArrhythmiaZone ? '#DC2626' : '#0EA5E9'; 
        renderCtx.lineWidth = isInArrhythmiaZone ? 2 : 1.5;
        renderCtx.moveTo(x1, y1);
        renderCtx.lineTo(x2, y2);
        renderCtx.stroke();
      }
      
      // Dibujar picos detectados en tiempo real directamente sobre los puntos altos de las ondas
      realTimePeaks.forEach(peak => {
        if (peak.x >= PEAK_VISIBLE_MARGIN && 
            peak.x <= canvas.width - PEAK_VISIBLE_MARGIN && 
            peak.y >= PEAK_VISIBLE_MARGIN && 
            peak.y <= canvas.height - PEAK_VISIBLE_MARGIN) {
          
          // Unificar color de círculos para los picos detectados en tiempo real - ahora todos azul
          renderCtx.beginPath();
          renderCtx.arc(peak.x, peak.y, PEAK_DISPLAY_RADIUS - 1, 0, Math.PI * 2);
          renderCtx.fillStyle = '#0EA5E9'; // Todos los picos detectados en tiempo real serán azules
          renderCtx.fill();
          renderCtx.strokeStyle = '#FFFFFF';
          renderCtx.lineWidth = 1.5;
          renderCtx.stroke();
          
          // Fondo claro para el valor numérico
          const valueText = Math.abs(peak.value).toFixed(2);
          renderCtx.font = PEAK_VALUE_FONT;
          const textWidth = renderCtx.measureText(valueText).width;
          
          renderCtx.fillStyle = 'rgba(255, 255, 255, 0.75)';
          renderCtx.fillRect(peak.x - textWidth/2 - 3, peak.y - PEAK_TEXT_OFFSET - 12, textWidth + 6, 16);
          
          // Mostrar valor del pico
          renderCtx.fillStyle = '#000000'; // Texto negro para mayor contraste
          renderCtx.textAlign = 'center';
          renderCtx.fillText(valueText, peak.x, peak.y - PEAK_TEXT_OFFSET);
        }
      });
      
      // Dibujar los picos recibidos del servicio (picos confirmados)
      peaksRef.current.forEach(peak => {
        // Calcular posición exacta del pico en el canvas
        const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
        const centerY = canvas.height / 2 - 50;
        const y = centerY - peak.value; // Posición vertical exacta en la onda
        
        // Solo dibujar los picos que están dentro del área visible
        if (x >= PEAK_VISIBLE_MARGIN && 
            x <= canvas.width - PEAK_VISIBLE_MARGIN && 
            y >= PEAK_VISIBLE_MARGIN && 
            y <= canvas.height - PEAK_VISIBLE_MARGIN) {
          
          const isInArrhythmiaZone = arrhythmiaWindows.some(window => 
            peak.time >= window.start && peak.time <= window.end
          );
          
          const isPeakInArrhythmiaZone = isInArrhythmiaZone; // Usar solo si cae en la ventana visual
          
          // Círculo del pico con contorno blanco para mejorar contraste
          renderCtx.beginPath();
          renderCtx.arc(x, y, PEAK_DISPLAY_RADIUS, 0, Math.PI * 2);
          // Color del círculo siempre normal ahora
          renderCtx.fillStyle = '#0EA5E9'; // Siempre azul
          renderCtx.fill();
          renderCtx.strokeStyle = '#FFFFFF';
          renderCtx.lineWidth = 1.5;
          renderCtx.stroke();
          
          // Texto con fondo semitransparente para legibilidad
          const valueText = Math.abs(peak.value / VERTICAL_SCALE).toFixed(2);
          renderCtx.font = PEAK_VALUE_FONT;
          const textWidth = renderCtx.measureText(valueText).width;
          
          // Fondo para el texto
          renderCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          renderCtx.fillRect(x - textWidth/2 - 3, y - PEAK_TEXT_OFFSET - 12, textWidth + 6, 16);
          
          // Valor del pico
          renderCtx.fillStyle = '#000000';
          renderCtx.textAlign = 'center';
          renderCtx.fillText(valueText, x, y - PEAK_TEXT_OFFSET);
          
          // Indicador de arritmia eliminado de la visualización del pico
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
  }, [
    value, quality, isFingerDetected, rawArrhythmiaData, arrhythmiaStatus, drawGrid, 
    smoothValue, preserveResults, isArrhythmia, drawArrhythmiaZones, arrhythmiaWindows,
    VERTICAL_SCALE, WINDOW_WIDTH_MS, FRAME_TIME, USE_OFFSCREEN_CANVAS, REQUIRED_FINGER_FRAMES,
    PEAK_DISPLAY_RADIUS, PEAK_TEXT_OFFSET, PEAK_VALUE_FONT, PEAK_VISIBLE_MARGIN,
    detectRealTimePeaks
  ]);

  useEffect(() => {
    renderSignal();
    
    return () => {
      cancelAnimationFrame(animationFrameRef.current!);
    };
  }, [renderSignal]);

  const handleReset = useCallback(() => {
    setShowArrhythmiaAlert(false);
    showArrhythmiaAlertRef.current = false;
    peaksRef.current = [];
    HeartRateService.reset();
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
          <span className="text-lg font-bold text-white/80">PPG</span>
          <div className="w-[180px]">
            <div className={`h-1 w-full rounded-full bg-gradient-to-r ${getQualityColor(quality)} transition-all duration-1000 ease-in-out`}>
              <div
                className="h-full rounded-full bg-white/20 animate-pulse transition-all duration-1000"
                style={{ width: `${resultsVisible ? displayQuality : 0}%` }}
              />
            </div>
            <span className="text-[8px] text-center mt-0.5 font-medium transition-colors duration-700 block text-white/80" 
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
          <span className="text-[8px] text-center font-medium text-white/80">
            {displayFingerDetected ? "Dedo detectado" : "Ubique su dedo"}
          </span>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-[60px] grid grid-cols-2 bg-transparent z-10">
        <button 
          onClick={onStartMeasurement}
          className="bg-transparent text-white/80 hover:bg-white/5 active:bg-white/10 transition-colors duration-200 text-sm font-semibold"
        >
          INICIAR
        </button>
        <button 
          onClick={handleReset}
          className="bg-transparent text-white/80 hover:bg-white/5 active:bg-white/10 transition-colors duration-200 text-sm font-semibold"
        >
          RESET
        </button>
      </div>
    </div>
  );
});

PPGSignalMeter.displayName = 'PPGSignalMeter';

export default PPGSignalMeter;
