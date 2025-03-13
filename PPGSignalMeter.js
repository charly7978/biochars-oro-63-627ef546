
import React, { useEffect, useRef, useState } from 'react';
import { Fingerprint } from 'lucide-react';

const PPGSignalMeter = ({ 
  value, 
  quality, 
  isFingerDetected,
  onStartMeasurement,
  onReset,
  arrhythmiaStatus
}) => {
  const canvasRef = useRef(null);
  const dataRef = useRef([]);
  const [startTime, setStartTime] = useState(Date.now());
  const WINDOW_WIDTH_MS = 5000;
  const CANVAS_WIDTH = 1000;
  const CANVAS_HEIGHT = 200;
  const verticalScale = 32.0;
  const baselineRef = useRef(null);
  const lastValueRef = useRef(0);
  const frameRef = useRef(null);
  const lastRenderTimeRef = useRef(0);
  const targetFPS = 60;
  const frameDuration = 1000 / targetFPS;

  const handleReset = () => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    dataRef.current = [];
    baselineRef.current = null;
    lastValueRef.current = 0;
    setStartTime(Date.now());
    onReset();
  };

  const getQualityColor = (quality) => {
    if (quality > 90) return 'from-emerald-500/80 to-emerald-400/80';
    if (quality > 75) return 'from-sky-500/80 to-sky-400/80';
    if (quality > 60) return 'from-indigo-500/80 to-indigo-400/80';
    if (quality > 40) return 'from-amber-500/80 to-amber-400/80';
    return 'from-red-500/80 to-red-400/80';
  };

  const getQualityText = (quality) => {
    if (quality > 90) return 'Excellent';
    if (quality > 75) return 'Very Good';
    if (quality > 60) return 'Good';
    if (quality > 40) return 'Fair';
    return 'Poor';
  };
  
  const renderSignal = () => {
    if (!canvasRef.current || !isFingerDetected) {
      frameRef.current = requestAnimationFrame(renderSignal);
      return;
    }

    const now = performance.now();
    const elapsed = now - lastRenderTimeRef.current;
    
    // Skip frames to maintain target FPS
    if (elapsed < frameDuration) {
      frameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      frameRef.current = requestAnimationFrame(renderSignal);
      return;
    }

    const currentTime = Date.now();
    
    if (baselineRef.current === null) {
      baselineRef.current = value;
    } else {
      // More responsive baseline adjustment for better tracking
      baselineRef.current = baselineRef.current * 0.98 + value * 0.02;
    }

    const normalizedValue = (value - (baselineRef.current || 0)) * verticalScale;
    const isWaveStart = lastValueRef.current < 0 && normalizedValue >= 0;
    lastValueRef.current = normalizedValue;
    
    // Use high-precision timestamps for better data point tracking
    dataRef.current.push({
      time: currentTime,
      value: normalizedValue,
      isWaveStart,
      isArrhythmia: false,
      renderTime: now
    });

    const cutoffTime = currentTime - WINDOW_WIDTH_MS;
    dataRef.current = dataRef.current.filter(point => point.time >= cutoffTime);

    // Efficient rendering with a clean slate each frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid with optimized rendering
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.15)';
    ctx.lineWidth = 0.5;
    
    // Batch grid lines for better performance
    ctx.beginPath();
    for (let i = 0; i < 40; i++) {
      const x = canvas.width - (canvas.width * (i / 40));
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      
      if (i % 4 === 0) {
        ctx.fillStyle = 'rgba(51, 65, 85, 0.5)';
        ctx.font = '12px Inter';
        ctx.fillText(`${i * 50}ms`, x - 25, canvas.height - 5);
      }
    }
    ctx.stroke();

    // Batch horizontal grid lines
    ctx.beginPath();
    const amplitudeLines = 10;
    for (let i = 0; i <= amplitudeLines; i++) {
      const y = (canvas.height / amplitudeLines) * i;
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // Center line
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    // Direct rendering of the waveform without unnecessary processing
    if (dataRef.current.length > 1) {
      ctx.lineWidth = 3;
      
      let waveStartIndex = 0;

      dataRef.current.forEach((point, index) => {
        if (point.isWaveStart || index === dataRef.current.length - 1) {
          if (index > waveStartIndex) {
            ctx.beginPath();
            ctx.strokeStyle = '#0ea5e9';
            
            const startPoint = dataRef.current[waveStartIndex];
            const xStart = canvas.width - ((currentTime - startPoint.time) * canvas.width / WINDOW_WIDTH_MS);
            const yStart = canvas.height / 2 + startPoint.value;
            
            // Only draw if within canvas bounds
            if (xStart >= 0 && xStart <= canvas.width) {
              ctx.moveTo(xStart, yStart);

              // Optimized path drawing - skip intermediary points if too dense
              const pointsToRender = index - waveStartIndex;
              const skipFactor = pointsToRender > 100 ? Math.floor(pointsToRender / 100) : 1;
              
              for (let i = waveStartIndex + skipFactor; i <= index; i += skipFactor) {
                const p = dataRef.current[i];
                const x = canvas.width - ((currentTime - p.time) * canvas.width / WINDOW_WIDTH_MS);
                const y = canvas.height / 2 + p.value;
                
                if (x >= 0 && x <= canvas.width) {
                  ctx.lineTo(x, y);
                }
              }
              
              ctx.stroke();
            }
          }
          waveStartIndex = index;
        }
      });
    }
    
    lastRenderTimeRef.current = now;
    frameRef.current = requestAnimationFrame(renderSignal);
  };

  useEffect(() => {
    // Start the high-performance animation loop
    frameRef.current = requestAnimationFrame(renderSignal);
    
    // Clean up on unmount
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isFingerDetected]);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-white to-slate-50/30">
      <div className="absolute top-0 left-0 right-0 p-2 flex justify-between items-center bg-white/60 backdrop-blur-sm border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-xl font-bold text-slate-700">PPG</span>
          <div className="flex flex-col flex-1">
            <div className={`h-1.5 w-[80%] mx-auto rounded-full bg-gradient-to-r ${getQualityColor(quality)} transition-all duration-300 ease-in-out`}>
              <div
                className="h-full rounded-full bg-white/20 animate-pulse transition-all duration-300"
                style={{ width: `${quality}%` }}
              />
            </div>
            <span className="text-[9px] text-center mt-0.5 font-medium transition-colors duration-300" 
                  style={{ color: quality > 60 ? '#0EA5E9' : '#F59E0B' }}>
              {getQualityText(quality)}
            </span>
          </div>
          
          <div className="flex flex-col items-center">
            <Fingerprint 
              size={56}
              className={`transition-all duration-300 ${
                isFingerDetected 
                  ? 'text-emerald-500 scale-100 drop-shadow-md'
                  : 'text-slate-300 scale-95'
              }`}
            />
            <span className="text-xs font-medium text-slate-600 transition-all duration-300">
              {isFingerDetected ? 'Dedo detectado' : 'Ubique su dedo en el lente'}
            </span>
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-[calc(40vh)] mt-20"
      />

      <div className="fixed bottom-0 left-0 right-0 h-[60px] grid grid-cols-2 gap-px bg-white/80 backdrop-blur-sm border-t border-slate-100">
        <button 
          onClick={onStartMeasurement}
          className="w-full h-full bg-white/80 hover:bg-slate-50/80 text-xl font-bold text-slate-700 transition-all duration-150 active:bg-slate-100"
        >
          INICIAR
        </button>
        <button 
          onClick={handleReset}
          className="w-full h-full bg-white/80 hover:bg-slate-50/80 text-xl font-bold text-slate-700 transition-all duration-150 active:bg-slate-100"
        >
          RESET
        </button>
      </div>
    </div>
  );
};

export default PPGSignalMeter; 
