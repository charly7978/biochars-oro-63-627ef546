import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Fingerprint } from 'lucide-react';
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
  const renderTimeRef = useRef<{
    lastRenderTime: number;
    renderDelays: number[];
    renderCount: number;
    avgRenderDelay: number;
  }>({
    lastRenderTime: 0,
    renderDelays: [],
    renderCount: 0,
    avgRenderDelay: 0
  });
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const peaksRef = useRef<{time: number, value: number, isArrhythmia: boolean}[]>([]);
  const [showArrhythmiaAlert, setShowArrhythmiaAlert] = useState(false);
  const qualityHistoryRef = useRef<number[]>([]);
  const consecutiveFingerFramesRef = useRef<number>(0);
  const lastHeartbeatTimeRef = useRef<number>(0);
  const lastSignalValueRef = useRef<number>(0);
  const realTimeStampRef = useRef<number>(Date.now());
  const noFingerFramesRef = useRef<number>(0);
  const MAX_NO_FINGER_FRAMES = 3;
  const lastPeaksCountRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const visiblePeaksCountRef = useRef<number>(0);

  const WINDOW_WIDTH_MS = 8000;
  const CANVAS_WIDTH = 2400;
  const CANVAS_HEIGHT = 1080;
  const GRID_SIZE_X = 35;
  const GRID_SIZE_Y = 5;
  const verticalScale = 45.0;
  const SMOOTHING_FACTOR = 1.6;
  const TARGET_FPS = 60;
  const BUFFER_SIZE = 700;
  const QUALITY_HISTORY_SIZE = 5;
  const REQUIRED_FINGER_FRAMES = 2;
  const MAX_RENDER_HISTORY = 10;
  const RENDER_DELAY_COMPENSATION = 0.8;

  useEffect(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer(BUFFER_SIZE);
      console.log('PPGSignalMeter: Buffer initialized', { 
        bufferSize: BUFFER_SIZE,
        timestamp: Date.now()
      });
    }
    
    if (!isFingerDetected) {
      noFingerFramesRef.current++;
      if (noFingerFramesRef.current >= MAX_NO_FINGER_FRAMES) {
        if (dataBufferRef.current && !preserveResults) {
          dataBufferRef.current.clear();
        }
      }
    } else {
      noFingerFramesRef.current = 0;
    }
    
    if (preserveResults && !isFingerDetected) {
      if (dataBufferRef.current) {
        dataBufferRef.current.clear();
      }
      peaksRef.current = [];
      baselineRef.current = null;
      lastValueRef.current = null;
    }
    
    if (!offscreenCanvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      offscreenCanvasRef.current = canvas;
      offscreenCtxRef.current = canvas.getContext('2d', { alpha: false });
      console.log('PPGSignalMeter: Offscreen canvas created', {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        hasContext: !!offscreenCtxRef.current
      });
    }
    
    const updateRealTimeStamp = () => {
      realTimeStampRef.current = Date.now();
      setTimeout(updateRealTimeStamp, 10);
    };
    
    const timeUpdateTimer = setTimeout(updateRealTimeStamp, 0);
    
    return () => clearTimeout(timeUpdateTimer);
  }, [preserveResults, isFingerDetected]);

  useEffect(() => {
    if (rawArrhythmiaData?.timestamp && rawArrhythmiaData.timestamp !== lastHeartbeatTimeRef.current) {
      lastHeartbeatTimeRef.current = rawArrhythmiaData.timestamp;
      
      const now = Date.now();
      const scaledValue = value * verticalScale;
      
      console.log('PPGSignalMeter: Registering external peak', {
        timestamp: now,
        value: scaledValue.toFixed(2),
        rawValue: value.toFixed(4),
        arrhythmiaData: rawArrhythmiaData 
      });
      
      peaksRef.current.push({
        time: now,
        value: scaledValue,
        isArrhythmia: false
      });
      
      if (peaksRef.current.length > 40) {
        peaksRef.current.shift();
      }
    }
    
    frameCountRef.current++;
    lastSignalValueRef.current = value;
    
    if (frameCountRef.current % 30 === 0) {
      console.log('PPGSignalMeter - Status Update:', {
        isFingerDetected,
        peakCount: peaksRef.current.length,
        visiblePeaksCount: visiblePeaksCountRef.current,
        signalQuality: quality.toFixed(2),
        timestamp: Date.now()
      });
    }
  }, [rawArrhythmiaData, value, quality, isFingerDetected]);

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

  const createGridCanvas = useCallback(() => {
    if (gridCanvasRef.current) return;
    
    console.log('PPGSignalMeter: Creating grid canvas');
    const offscreen = document.createElement('canvas');
    offscreen.width = CANVAS_WIDTH;
    offscreen.height = CANVAS_HEIGHT;
    const offCtx = offscreen.getContext('2d', { alpha: false });
    
    if (!offCtx) return;
    
    const gradient = offCtx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#E5DEFF');
    gradient.addColorStop(0.3, '#FDE1D3');
    gradient.addColorStop(0.7, '#F2FCE2');
    gradient.addColorStop(1, '#D3E4FD');
    
    offCtx.fillStyle = gradient;
    offCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    offCtx.globalAlpha = 0.03;
    for (let i = 0; i < CANVAS_WIDTH; i += 20) {
      for (let j = 0; j < CANVAS_HEIGHT; j += 20) {
        offCtx.fillStyle = j % 40 === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
        offCtx.fillRect(i, j, 10, 10);
      }
    }
    offCtx.globalAlpha = 1.0;
    
    offCtx.beginPath();
    offCtx.strokeStyle = 'rgba(60, 60, 60, 0.2)';
    offCtx.lineWidth = 0.5;
    
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE_X) {
      offCtx.moveTo(x, 0);
      offCtx.lineTo(x, CANVAS_HEIGHT);
      if (x % (GRID_SIZE_X * 5) === 0) {
        offCtx.fillStyle = 'rgba(50, 50, 50, 0.6)';
        offCtx.font = '10px Inter';
        offCtx.textAlign = 'center';
        offCtx.fillText(x.toString(), x, CANVAS_HEIGHT - 5);
      }
    }
    
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE_Y) {
      offCtx.moveTo(0, y);
      offCtx.lineTo(CANVAS_WIDTH, y);
      if (y % (GRID_SIZE_Y * 5) === 0) {
        offCtx.fillStyle = 'rgba(50, 50, 50, 0.6)';
        offCtx.font = '10px Inter';
        offCtx.textAlign = 'right';
        offCtx.fillText(y.toString(), 15, y + 3);
      }
    }
    offCtx.stroke();
    
    const centerLineY = (CANVAS_HEIGHT / 2) - 40;
    offCtx.beginPath();
    offCtx.strokeStyle = 'rgba(40, 40, 40, 0.4)';
    offCtx.lineWidth = 1.5;
    offCtx.setLineDash([5, 3]);
    offCtx.moveTo(0, centerLineY);
    offCtx.lineTo(CANVAS_WIDTH, centerLineY);
    offCtx.stroke();
    offCtx.setLineDash([]);
    
    if (arrhythmiaStatus) {
      const [status, count] = arrhythmiaStatus.split('|');
      
      if (status.includes("ARRITMIA") && count === "1" && !showArrhythmiaAlert) {
        offCtx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        offCtx.fillRect(30, 70, 350, 40);
        offCtx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        offCtx.lineWidth = 2;
        offCtx.strokeRect(30, 70, 350, 40);
        
        offCtx.fillStyle = '#ef4444';
        offCtx.font = 'bold 24px Inter';
        offCtx.textAlign = 'left';
        offCtx.fillText('¡PRIMERA ARRITMIA DETECTADA!', 45, 95);
        setShowArrhythmiaAlert(true);
      } else if (status.includes("ARRITMIA") && Number(count) > 1) {
        offCtx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        offCtx.fillRect(30, 70, 250, 40);
        offCtx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        offCtx.lineWidth = 2;
        offCtx.strokeRect(30, 70, 250, 40);
        
        offCtx.fillStyle = '#ef4444';
        offCtx.font = 'bold 24px Inter';
        offCtx.textAlign = 'left';
        offCtx.fillText(`Arritmias detectadas: ${count}`, 45, 95);
      }
    }
    
    gridCanvasRef.current = offscreen;
  }, [arrhythmiaStatus, showArrhythmiaAlert]);

  const renderSignal = useCallback(() => {
    const renderStartTime = performance.now(); 
    renderTimeRef.current.renderCount++;
    
    if (!canvasRef.current || !dataBufferRef.current) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    
    if (!ctx || !offscreenCtxRef.current) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    createGridCanvas();
    
    const offCtx = offscreenCtxRef.current;
    
    if (gridCanvasRef.current) {
      offCtx.drawImage(gridCanvasRef.current, 0, 0);
    }
    
    if (preserveResults && !isFingerDetected) {
      ctx.drawImage(offscreenCanvasRef.current!, 0, 0);
      renderTimeRef.current.lastRenderTime = performance.now();
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const now = Date.now();
    
    if (isFingerDetected) {
      if (baselineRef.current === null) {
        baselineRef.current = value;
      } else {
        const adaptationRate = 0.94;
        baselineRef.current = baselineRef.current * adaptationRate + value * (1 - adaptationRate);
      }
      
      const smoothingFactor = SMOOTHING_FACTOR * 0.8;
      const smoothedValue = lastValueRef.current === null ? 
        value : lastValueRef.current + smoothingFactor * (value - lastValueRef.current);
      
      lastValueRef.current = smoothedValue;
      
      const normalizedValue = (baselineRef.current || 0) - smoothedValue;
      const scaledValue = normalizedValue * verticalScale;
      
      let isArrhythmia = false;
      if (rawArrhythmiaData && 
          arrhythmiaStatus?.includes("ARRITMIA") && 
          now - rawArrhythmiaData.timestamp < 500) {
        isArrhythmia = true;
      }
      
      const dataPoint: PPGDataPoint = {
        time: now,
        value: scaledValue,
        isArrhythmia
      };
      
      dataBufferRef.current.push(dataPoint);
    }
    
    const points = dataBufferRef.current.getPoints();
    
    if (points.length > 1) {
      offCtx.beginPath();
      offCtx.strokeStyle = '#0EA5E9';
      offCtx.lineWidth = 2;
      offCtx.lineJoin = 'round';
      offCtx.lineCap = 'round';
      
      let firstPoint = true;
      
      const cutoffTime = now - WINDOW_WIDTH_MS;
      const visiblePoints = points.filter(pt => pt.time >= cutoffTime);
      
      for (let i = 1; i < visiblePoints.length; i++) {
        const prevPoint = visiblePoints[i - 1];
        const point = visiblePoints[i];
        
        const x1 = canvas.width - ((now - prevPoint.time) * canvas.width / WINDOW_WIDTH_MS);
        const y1 = (canvas.height / 2) - 40 - prevPoint.value;
        
        const x2 = canvas.width - ((now - point.time) * canvas.width / WINDOW_WIDTH_MS);
        const y2 = (canvas.height / 2) - 40 - point.value;
        
        if (firstPoint) {
          offCtx.moveTo(x1, y1);
          firstPoint = false;
        }
        
        offCtx.lineTo(x2, y2);
        
        if (point.isArrhythmia) {
          offCtx.stroke();
          offCtx.beginPath();
          offCtx.strokeStyle = '#DC2626';
          offCtx.moveTo(x1, y1);
          offCtx.lineTo(x2, y2);
          offCtx.stroke();
          offCtx.beginPath();
          offCtx.strokeStyle = '#0EA5E9';
          offCtx.moveTo(x2, y2);
          firstPoint = true;
        }
      }
      
      offCtx.stroke();
      
      const recentPeaks = peaksRef.current.filter(peak => now - peak.time <= WINDOW_WIDTH_MS);
      visiblePeaksCountRef.current = recentPeaks.length;
      
      if (lastPeaksCountRef.current !== recentPeaks.length && renderTimeRef.current.renderCount % 10 === 0) {
        console.log('PPGSignalMeter - Drawing peaks:', {
          peakCount: recentPeaks.length,
          totalPeaks: peaksRef.current.length,
          visiblePoints: visiblePoints.length,
          windowWidthMs: WINDOW_WIDTH_MS,
          now,
          timeString: new Date(now).toISOString()
        });
        
        lastPeaksCountRef.current = recentPeaks.length;
      }
      
      recentPeaks.forEach(peak => {
        const timeSinceNow = now - peak.time;
        
        if (timeSinceNow > WINDOW_WIDTH_MS) return;
        
        const x = canvas.width - (timeSinceNow * canvas.width / WINDOW_WIDTH_MS);
        const y = (canvas.height / 2) - 40 - peak.value;
        
        if (x >= 0 && x <= canvas.width) {
          const circleColor = peak.isArrhythmia ? '#FEF08A' : '#0EA5E9';
          const glowColor = peak.isArrhythmia ? 'rgba(254, 240, 138, 0.6)' : 'rgba(14, 165, 233, 0.6)';
          
          const gradient = offCtx.createRadialGradient(x, y, 3, x, y, 15);
          gradient.addColorStop(0, glowColor);
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          
          offCtx.beginPath();
          offCtx.arc(x, y, 15, 0, Math.PI * 2);
          offCtx.fillStyle = gradient;
          offCtx.fill();
          
          offCtx.beginPath();
          offCtx.arc(x, y, 8, 0, Math.PI * 2);
          offCtx.fillStyle = circleColor;
          offCtx.fill();
          
          offCtx.beginPath();
          offCtx.arc(x, y, 8, 0, Math.PI * 2);
          offCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          offCtx.lineWidth = 1.5;
          offCtx.stroke();
          
          const displayValue = Math.abs(peak.value / verticalScale).toFixed(3);
          
          offCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          const textWidth = offCtx.measureText(displayValue).width;
          offCtx.fillRect(x - textWidth/2 - 4, y - 35, textWidth + 8, 20);
          
          offCtx.font = 'bold 12px Inter';
          offCtx.fillStyle = 'white';
          offCtx.textAlign = 'center';
          offCtx.fillText(displayValue, x, y - 22);
          
          const timeDisplay = `${Math.round(timeSinceNow)}ms`;
          const timeTextWidth = offCtx.measureText(timeDisplay).width;
          
          offCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          offCtx.fillRect(x - timeTextWidth/2 - 3, y + 15, timeTextWidth + 6, 16);
          
          offCtx.font = '10px Inter';
          offCtx.fillStyle = '#F0F0F0';
          offCtx.fillText(timeDisplay, x, y + 27);
          
          if (peak.isArrhythmia) {
            offCtx.beginPath();
            offCtx.arc(x, y, 15, 0, Math.PI * 2);
            offCtx.strokeStyle = '#FEF08A';
            offCtx.lineWidth = 2;
            offCtx.setLineDash([3, 2]);
            offCtx.stroke();
            offCtx.setLineDash([]);
            
            offCtx.font = 'bold 14px Inter';
            offCtx.fillStyle = '#FEF08A';
            offCtx.textAlign = 'center';
            
            const arrTextWidth = offCtx.measureText("LATIDO PREMATURO").width;
            offCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            offCtx.fillRect(x - arrTextWidth/2 - 5, y - 55, arrTextWidth + 10, 22);
            
            offCtx.fillStyle = '#FEF08A';
            offCtx.fillText("LATIDO PREMATURO", x, y - 40);
          }
        }
      });
    }
    
    ctx.drawImage(offscreenCanvasRef.current!, 0, 0);
    
    const renderEndTime = performance.now();
    const renderDelay = renderEndTime - renderStartTime;
    
    renderTimeRef.current.renderDelays.push(renderDelay);
    if (renderTimeRef.current.renderDelays.length > MAX_RENDER_HISTORY) {
      renderTimeRef.current.renderDelays.shift();
    }
    
    renderTimeRef.current.avgRenderDelay = 
      renderTimeRef.current.renderDelays.reduce((sum, delay) => sum + delay, 0) / 
      renderTimeRef.current.renderDelays.length;
    
    if (renderTimeRef.current.renderCount % 180 === 0) {
      console.log('PPGSignalMeter - Rendering Performance:', {
        avgDelay: renderTimeRef.current.avgRenderDelay.toFixed(2) + 'ms',
        fps: (1000 / renderTimeRef.current.avgRenderDelay).toFixed(1),
        pointCount: points.length,
        peakCount: peaksRef.current.length,
        visiblePeaks: visiblePeaksCountRef.current,
        bufferUsage: `${(points.length / BUFFER_SIZE * 100).toFixed(1)}%`,
        timestamp: new Date(now).toISOString(),
        isFingerDetected
      });
    }
    
    renderTimeRef.current.lastRenderTime = renderEndTime;
    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [value, quality, isFingerDetected, rawArrhythmiaData, arrhythmiaStatus, preserveResults, createGridCanvas]);

  useEffect(() => {
    renderSignal();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
    };
  }, [renderSignal]);

  useEffect(() => {
    createGridCanvas();
  }, [createGridCanvas]);

  const handleReset = useCallback(() => {
    console.log('PPGSignalMeter - Reset called', {
      timestamp: Date.now(),
      peakCount: peaksRef.current.length,
      bufferSize: dataBufferRef.current?.getPoints().length || 0
    });
    
    setShowArrhythmiaAlert(false);
    peaksRef.current = [];
    
    if (dataBufferRef.current) {
      dataBufferRef.current.clear();
    }
    
    baselineRef.current = null;
    lastValueRef.current = null;
    
    renderTimeRef.current = {
      lastRenderTime: 0,
      renderDelays: [],
      renderCount: 0,
      avgRenderDelay: 0
    };
    
    gridCanvasRef.current = null;
    frameCountRef.current = 0;
    lastPeaksCountRef.current = 0;
    visiblePeaksCountRef.current = 0;
    
    onReset();
    
    console.log('PPGSignalMeter - Reset completed');
  }, [onReset, createGridCanvas]);

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
    const isFingerConfirmed = consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES;
    
    if (!isFingerConfirmed) return 'from-gray-400 to-gray-500';
    if (avgQuality > 65) return 'from-green-500 to-emerald-500';
    if (avgQuality > 40) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  }, [getAverageQuality]);

  const getQualityText = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    const isFingerConfirmed = consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES;
    
    if (!isFingerConfirmed) return 'Sin detección';
    if (avgQuality > 65) return 'Señal óptima';
    if (avgQuality > 40) return 'Señal aceptable';
    return 'Señal débil';
  }, [getAverageQuality]);

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
