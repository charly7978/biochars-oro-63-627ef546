
import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  const animationFrameRef = useRef(null);
  const lastRenderTimeRef = useRef(0);
  const gridCanvasRef = useRef(null);
  const WINDOW_WIDTH_MS = 5000;
  const CANVAS_WIDTH = 1000;
  const CANVAS_HEIGHT = 200;
  const verticalScale = 32.0;
  const baselineRef = useRef(null);
  const lastValueRef = useRef(0);
  
  // Nuevas referencias para optimización
  const cachedWaveformRef = useRef(null);
  const lastDataLengthRef = useRef(0);
  const renderCountRef = useRef(0);
  const highPerformanceMode = true; // Activar modo de alto rendimiento

  const handleReset = () => {
    dataRef.current = [];
    baselineRef.current = null;
    lastValueRef.current = 0;
    setStartTime(Date.now());
    onReset();
    
    // Reiniciar caches para renderizado
    cachedWaveformRef.current = null;
    lastDataLengthRef.current = 0;
    renderCountRef.current = 0;

    // Limpiar loop de animación previo
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  // Memoizar cálculos de calidad para evitar recálculos innecesarios
  const qualityData = useMemo(() => {
    const qualityColor = () => {
      if (quality > 90) return 'from-emerald-500/80 to-emerald-400/80';
      if (quality > 75) return 'from-sky-500/80 to-sky-400/80';
      if (quality > 60) return 'from-indigo-500/80 to-indigo-400/80';
      if (quality > 40) return 'from-amber-500/80 to-amber-400/80';
      return 'from-red-500/80 to-red-400/80';
    };

    const qualityText = () => {
      if (quality > 90) return 'Excellent';
      if (quality > 75) return 'Very Good';
      if (quality > 60) return 'Good';
      if (quality > 40) return 'Fair';
      return 'Poor';
    };

    return {
      color: qualityColor(),
      text: qualityText()
    };
  }, [quality]);

  const drawBackgroundGrid = (ctx) => {
    // Si no tenemos la cuadrícula en caché, crearla
    if (!gridCanvasRef.current) {
      const gridCanvas = document.createElement('canvas');
      gridCanvas.width = CANVAS_WIDTH;
      gridCanvas.height = CANVAS_HEIGHT;
      const gridCtx = gridCanvas.getContext('2d', { alpha: false });
      
      // Dibujar fondo
      gridCtx.fillStyle = '#F8FAFC';
      gridCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Dibujar líneas de cuadrícula
      gridCtx.strokeStyle = 'rgba(51, 65, 85, 0.15)';
      gridCtx.lineWidth = 0.5;
      
      for (let i = 0; i < 40; i++) {
        const x = CANVAS_WIDTH - (CANVAS_WIDTH * (i / 40));
        gridCtx.beginPath();
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, CANVAS_HEIGHT);
        gridCtx.stroke();
        
        if (i % 4 === 0) {
          gridCtx.fillStyle = 'rgba(51, 65, 85, 0.5)';
          gridCtx.font = '12px Inter';
          gridCtx.fillText(`${i * 50}ms`, x - 25, CANVAS_HEIGHT - 5);
        }
      }
      
      const amplitudeLines = 10;
      for (let i = 0; i <= amplitudeLines; i++) {
        const y = (CANVAS_HEIGHT / amplitudeLines) * i;
        gridCtx.beginPath();
        gridCtx.moveTo(0, y);
        gridCtx.lineTo(CANVAS_WIDTH, y);
        gridCtx.stroke();
      }
      
      gridCtx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
      gridCtx.lineWidth = 1;
      gridCtx.beginPath();
      gridCtx.moveTo(0, CANVAS_HEIGHT / 2);
      gridCtx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
      gridCtx.stroke();
      
      gridCanvasRef.current = gridCanvas;
    }
    
    // Usar la cuadrícula en caché
    ctx.drawImage(gridCanvasRef.current, 0, 0);
  };

  // Función optimizada para renderizar la señal
  const renderOptimizedSignal = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      animationFrameRef.current = requestAnimationFrame(renderOptimizedSignal);
      return;
    }
    
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(renderOptimizedSignal);
      return;
    }
    
    // Control de FPS para mantener un ritmo estable
    const now = performance.now();
    const elapsed = now - lastRenderTimeRef.current;
    const targetFrameTime = 1000 / 60; // Apuntar a 60 FPS
    
    // Solo renderizar si es tiempo o si hay cambios significativos
    if (elapsed >= targetFrameTime || lastDataLengthRef.current !== dataRef.current.length) {
      // Dibujar cuadrícula de fondo desde caché
      drawBackgroundGrid(ctx);
      
      const currentTime = Date.now();
      renderCountRef.current++;
      
      // Renderizado de la forma de onda PPG
      if (dataRef.current.length > 1) {
        ctx.lineWidth = 3;
        
        let waveStartIndex = 0;
        
        // Dividir en batches para renderizado más eficiente
        const batchSize = highPerformanceMode ? 4 : 1;
        let currentBatch = [];
        
        dataRef.current.forEach((point, index) => {
          if (point.isWaveStart || index === dataRef.current.length - 1) {
            if (index > waveStartIndex) {
              // Acumular puntos para procesar en lotes
              currentBatch.push({
                startIdx: waveStartIndex,
                endIdx: index
              });
              
              // Procesar en batches para mayor eficiencia
              if (currentBatch.length >= batchSize || index === dataRef.current.length - 1) {
                ctx.beginPath();
                ctx.strokeStyle = '#0ea5e9';
                
                // Procesar todos los puntos del batch actual
                for (const batch of currentBatch) {
                  const startPoint = dataRef.current[batch.startIdx];
                  
                  // Primera vez, mover al punto inicial
                  if (batch === currentBatch[0]) {
                    ctx.moveTo(
                      CANVAS_WIDTH - ((currentTime - startPoint.time) * CANVAS_WIDTH / WINDOW_WIDTH_MS),
                      CANVAS_HEIGHT / 2 + startPoint.value
                    );
                  }
                  
                  // Dibujar resto de puntos en el batch
                  for (let i = batch.startIdx + 1; i <= batch.endIdx; i++) {
                    const p = dataRef.current[i];
                    ctx.lineTo(
                      CANVAS_WIDTH - ((currentTime - p.time) * CANVAS_WIDTH / WINDOW_WIDTH_MS),
                      CANVAS_HEIGHT / 2 + p.value
                    );
                  }
                }
                
                // Dibujar todos los batches acumulados de una vez
                ctx.stroke();
                currentBatch = [];
              }
            }
            waveStartIndex = index;
          }
        });
      }
      
      lastRenderTimeRef.current = now;
      lastDataLengthRef.current = dataRef.current.length;
    }
    
    // Mantener el loop de animación
    animationFrameRef.current = requestAnimationFrame(renderOptimizedSignal);
  };

  useEffect(() => {
    if (!canvasRef.current || !isFingerDetected) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentTime = Date.now();
    
    if (baselineRef.current === null) {
      baselineRef.current = value;
    } else {
      baselineRef.current = baselineRef.current * 0.95 + value * 0.05;
    }

    const normalizedValue = (value - (baselineRef.current || 0)) * verticalScale;
    const isWaveStart = lastValueRef.current < 0 && normalizedValue >= 0;
    lastValueRef.current = normalizedValue;
    
    dataRef.current.push({
      time: currentTime,
      value: normalizedValue,
      isWaveStart,
      isArrhythmia: false
    });

    const cutoffTime = currentTime - WINDOW_WIDTH_MS;
    dataRef.current = dataRef.current.filter(point => point.time >= cutoffTime);

  }, [value, quality, isFingerDetected, arrhythmiaStatus]);

  // Efecto para iniciar el loop de renderizado independiente (desacoplado)
  useEffect(() => {
    // Iniciar el ciclo de renderizado optimizado y separado
    if (!animationFrameRef.current) {
      renderOptimizedSignal();
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-white to-slate-50/30">
      <div className="absolute top-0 left-0 right-0 p-2 flex justify-between items-center bg-white/60 backdrop-blur-sm border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-xl font-bold text-slate-700">PPG</span>
          <div className="flex flex-col flex-1">
            <div className={`h-1.5 w-[80%] mx-auto rounded-full bg-gradient-to-r ${qualityData.color} transition-all duration-1000 ease-in-out`}>
              <div
                className="h-full rounded-full bg-white/20 animate-pulse transition-all duration-1000"
                style={{ width: `${quality}%` }}
              />
            </div>
            <span className="text-[9px] text-center mt-0.5 font-medium transition-colors duration-700" 
                  style={{ color: quality > 60 ? '#0EA5E9' : '#F59E0B' }}>
              {qualityData.text}
            </span>
          </div>
          
          <div className="flex flex-col items-center">
            <Fingerprint 
              size={56}
              className={`transition-all duration-700 ${
                isFingerDetected 
                  ? 'text-emerald-500 scale-100 drop-shadow-md'
                  : 'text-slate-300 scale-95'
              }`}
            />
            <span className="text-xs font-medium text-slate-600 transition-all duration-700">
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
          className="w-full h-full bg-white/80 hover:bg-slate-50/80 text-xl font-bold text-slate-700 transition-all duration-300"
        >
          INICIAR
        </button>
        <button 
          onClick={handleReset}
          className="w-full h-full bg-white/80 hover:bg-slate-50/80 text-xl font-bold text-slate-700 transition-all duration-300"
        >
          RESET
        </button>
      </div>
    </div>
  );
};

export default PPGSignalMeter; 
