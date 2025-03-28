
import React, { useEffect, useRef, useCallback, useState, memo } from 'react';
import { Fingerprint, HeartPulse, AlertTriangle } from 'lucide-react';
import { CircularBuffer } from '../utils/CircularBuffer';

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
    severity?: string;
  } | null;
  preserveResults?: boolean;
  isArrhythmia?: boolean;
}

interface PPGDataPoint {
  time: number;
  value: number;
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
  const dataBufferRef = useRef<CircularBuffer<PPGDataPoint> | null>(null);
  const baselineRef = useRef<number | null>(null);
  const lastValueRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);
  const lastArrhythmiaTime = useRef<number>(0);
  const arrhythmiaCountRef = useRef<number>(0);
  const peaksRef = useRef<{time: number, value: number, isArrhythmia: boolean}[]>([]);
  const [showArrhythmiaAlert, setShowArrhythmiaAlert] = useState(false);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qualityHistoryRef = useRef<number[]>([]);
  const consecutiveFingerFramesRef = useRef<number>(0);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const arrhythmiaSegmentsRef = useRef<Array<{startTime: number, endTime: number | null}>>([]);
  
  const WINDOW_WIDTH_MS = 3500;
  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 600;
  const GRID_SIZE_X = 25;
  const GRID_SIZE_Y = 5;
  const verticalScale = 35.0;
  const PEAK_DETECTION_WINDOW = 8;
  const PEAK_THRESHOLD = 0.3;
  const MAX_PEAKS_TO_DISPLAY = 30;

  useEffect(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer<PPGDataPoint>(600);
    }
    
    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = CANVAS_WIDTH;
    gridCanvas.height = CANVAS_HEIGHT;
    const gridCtx = gridCanvas.getContext('2d', { alpha: false });
    
    if (gridCtx) {
      drawGrid(gridCtx);
      gridCanvasRef.current = gridCanvas;
    }
    
    renderSignal();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    qualityHistoryRef.current.push(quality);
    if (qualityHistoryRef.current.length > 9) {
      qualityHistoryRef.current.shift();
    }
    
    if (isFingerDetected) {
      consecutiveFingerFramesRef.current++;
    } else {
      consecutiveFingerFramesRef.current = 0;
    }
    
    if (isFingerDetected && dataBufferRef.current) {
      const isCurrentArrhythmia = isArrhythmia || 
        (arrhythmiaStatus && arrhythmiaStatus.toLowerCase().includes('arritmia'));
      
      const now = Date.now();
      dataBufferRef.current.push({
        time: now,
        value: value,
        isArrhythmia: isCurrentArrhythmia
      });
      
      if (isCurrentArrhythmia) {
        setShowArrhythmiaAlert(true);
        setTimeout(() => setShowArrhythmiaAlert(false), 2000);
        
        const lastSegment = arrhythmiaSegmentsRef.current[arrhythmiaSegmentsRef.current.length - 1];
        
        if (!lastSegment || lastSegment.endTime !== null) {
          arrhythmiaSegmentsRef.current.push({
            startTime: now,
            endTime: null
          });
          lastArrhythmiaTime.current = now;
          
          if (arrhythmiaStatus && arrhythmiaStatus.includes('|')) {
            const parts = arrhythmiaStatus.split('|');
            if (parts.length > 1) {
              arrhythmiaCountRef.current = parseInt(parts[1], 10) || arrhythmiaCountRef.current;
            } else if (arrhythmiaCountRef.current === 0) {
              arrhythmiaCountRef.current = 1;
            }
          } else if (arrhythmiaCountRef.current === 0) {
            arrhythmiaCountRef.current = 1;
          }
        }
      } else {
        const lastSegment = arrhythmiaSegmentsRef.current[arrhythmiaSegmentsRef.current.length - 1];
        if (lastSegment && lastSegment.endTime === null) {
          lastSegment.endTime = now;
        }
      }
    }
  }, [value, quality, isFingerDetected, arrhythmiaStatus, rawArrhythmiaData, isArrhythmia]);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.2)';
    ctx.lineWidth = 0.5;
    
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE_X) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
    }
    
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE_Y) {
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
    }
    ctx.stroke();
    
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.moveTo(0, CANVAS_HEIGHT / 2);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  const detectPeaks = useCallback((points: PPGDataPoint[], now: number) => {
    if (points.length < PEAK_DETECTION_WINDOW) return;
    
    for (let i = PEAK_DETECTION_WINDOW; i < points.length - PEAK_DETECTION_WINDOW; i++) {
      const currentPoint = points[i];
      
      const alreadyDetected = peaksRef.current.some(peak => 
        Math.abs(peak.time - currentPoint.time) < 100
      );
      
      if (alreadyDetected) continue;
      
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
        peaksRef.current.push({
          time: currentPoint.time,
          value: currentPoint.value,
          isArrhythmia: currentPoint.isArrhythmia || false
        });
      }
    }
    
    peaksRef.current = peaksRef.current
      .filter(peak => now - peak.time < WINDOW_WIDTH_MS)
      .slice(-MAX_PEAKS_TO_DISPLAY);
  }, []);

  const renderSignal = useCallback(() => {
    const canvas = canvasRef.current;
    const buffer = dataBufferRef.current;
    
    if (canvas && buffer) {
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        const now = Date.now();
        const points = buffer.getPoints();
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (gridCanvasRef.current) {
          ctx.drawImage(gridCanvasRef.current, 0, 0);
        }
        
        detectPeaks(points, now);
        
        ctx.fillStyle = 'rgba(255, 50, 50, 0.15)';
        
        for (const segment of arrhythmiaSegmentsRef.current) {
          if (now - segment.startTime > WINDOW_WIDTH_MS) continue;
          
          const startX = canvas.width - ((now - segment.startTime) * canvas.width / WINDOW_WIDTH_MS);
          const endX = segment.endTime ? 
            canvas.width - ((now - segment.endTime) * canvas.width / WINDOW_WIDTH_MS) : 
            canvas.width;
          
          ctx.fillRect(startX, 0, endX - startX, canvas.height);
        }
        
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(50, 205, 50, 0.8)';
        
        let isFirstPoint = true;
        let lastX = 0;
        let lastY = 0;
        
        for (let i = 0; i < points.length; i++) {
          const point = points[i];
          const age = now - point.time;
          
          if (age > WINDOW_WIDTH_MS) continue;
          
          const x = canvas.width - (age * canvas.width / WINDOW_WIDTH_MS);
          const y = canvas.height / 2 - (point.value * verticalScale);
          
          if (isFirstPoint) {
            ctx.moveTo(x, y);
            isFirstPoint = false;
          } else {
            const controlX = (lastX + x) / 2;
            ctx.quadraticCurveTo(controlX, lastY, x, y);
          }
          
          lastX = x;
          lastY = y;
        }
        
        ctx.stroke();
        
        for (const peak of peaksRef.current) {
          const age = now - peak.time;
          if (age > WINDOW_WIDTH_MS) continue;
          
          const x = canvas.width - (age * canvas.width / WINDOW_WIDTH_MS);
          const y = canvas.height / 2 - (peak.value * verticalScale);
          
          ctx.beginPath();
          ctx.arc(x, y, peak.isArrhythmia ? 6 : 4, 0, Math.PI * 2);
          ctx.fillStyle = peak.isArrhythmia ? '#ff3333' : '#33ff33';
          ctx.fill();
        }
        
        if (arrhythmiaStatus && arrhythmiaStatus !== "--") {
          const displayStatus = arrhythmiaStatus.split('|')[0];
          ctx.font = 'bold 16px Arial';
          ctx.fillStyle = arrhythmiaStatus.toLowerCase().includes('arritmia') ? '#ff3333' : '#33ff33';
          ctx.fillText(displayStatus, 20, 30);
          
          if (arrhythmiaStatus.toLowerCase().includes('arritmia') && rawArrhythmiaData) {
            ctx.font = '14px Arial';
            ctx.fillText(`RMSSD: ${rawArrhythmiaData.rmssd.toFixed(1)}`, 20, 50);
            ctx.fillText(`Variación: ${rawArrhythmiaData.rrVariation.toFixed(1)}%`, 20, 70);
            
            if (rawArrhythmiaData.severity) {
              ctx.fillText(`Severidad: ${rawArrhythmiaData.severity}`, 20, 90);
            }
          }
        }
        
        if (arrhythmiaCountRef.current > 0) {
          ctx.font = 'bold 18px Arial';
          ctx.fillStyle = '#ff3333';
          ctx.fillText(`Arritmias detectadas: ${arrhythmiaCountRef.current}`, canvas.width - 250, 30);
        }
      }
    }
    
    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [detectPeaks]);

  const getQualityColor = useCallback(() => {
    const avgQuality = qualityHistoryRef.current.length 
      ? qualityHistoryRef.current.reduce((a, b) => a + b, 0) / qualityHistoryRef.current.length
      : 0;
    
    if (!isFingerDetected || consecutiveFingerFramesRef.current < 3) return 'from-gray-400 to-gray-500';
    if (avgQuality > 65) return 'from-green-500 to-emerald-500';
    if (avgQuality > 40) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  }, [isFingerDetected]);

  const getQualityText = useCallback(() => {
    const avgQuality = qualityHistoryRef.current.length 
      ? qualityHistoryRef.current.reduce((a, b) => a + b, 0) / qualityHistoryRef.current.length
      : 0;
    
    if (!isFingerDetected || consecutiveFingerFramesRef.current < 3) return 'Sin detección';
    if (avgQuality > 65) return 'Señal óptima';
    if (avgQuality > 40) return 'Señal aceptable';
    return 'Señal débil';
  }, [isFingerDetected]);

  return (
    <div className="relative w-full h-full flex flex-col justify-center items-center">
      <div className="absolute top-5 left-5 flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${isFingerDetected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-white text-sm">
          {isFingerDetected ? 'Dedo detectado' : 'Coloque su dedo en la cámara'}
        </span>
      </div>
      
      {showArrhythmiaAlert && (
        <div className="absolute top-5 right-5 flex items-center space-x-2 bg-red-500/20 p-2 rounded">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <span className="text-red-500 font-semibold">Arritmia detectada</span>
        </div>
      )}
      
      <div className="relative w-full h-3/4 bg-black rounded-lg overflow-hidden border border-gray-700">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full"
        />
        
        <div className="absolute bottom-4 right-4 flex items-center space-x-2">
          <div className="text-white text-sm">{getQualityText()}</div>
          <div className={`w-20 h-3 rounded-full bg-gradient-to-r ${getQualityColor()}`} />
        </div>
        
        {arrhythmiaCountRef.current > 0 && (
          <div className="absolute top-4 right-4 flex items-center space-x-2 bg-black/40 p-2 rounded">
            <HeartPulse className="h-5 w-5 text-red-500" />
            <span className="text-red-500 font-semibold">
              {arrhythmiaCountRef.current} {arrhythmiaCountRef.current === 1 ? 'arritmia' : 'arritmias'}
            </span>
          </div>
        )}
      </div>
      
      <div className="mt-4 flex space-x-4">
        <button
          onClick={onStartMeasurement}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-2"
        >
          <Fingerprint className="h-5 w-5" />
          <span>Iniciar medición</span>
        </button>
        
        <button
          onClick={onReset}
          className="px-6 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg"
        >
          Reset
        </button>
      </div>
    </div>
  );
});

export default PPGSignalMeter;
